import { t } from "./i18n";
import type {
  AnalysisResult,
  GroupStatistics,
  ProfilePoint,
} from "./types";

type EChartsRuntime = typeof import("./statistics-chart-runtime")["echarts"];
type ChartInstance = ReturnType<EChartsRuntime["init"]>;
type ChartOption = Parameters<ChartInstance["setOption"]>[0];
type ProfileMetric = "mean" | "standardDeviation";

interface HistogramDatum {
  value: [number, number];
  dnStart: number;
  dnEnd: number;
}

interface TooltipSeriesParameter {
  marker?: string;
  seriesName?: string;
  data?: HistogramDatum | [number, number];
  value?: [number, number];
}

const GROUP_COLORS: Record<string, string> = {
  all: "#5fc7e8",
  Y: "#d5e4ee",
  R: "#ef6680",
  G: "#72d995",
  Gr: "#a4e86f",
  Gb: "#50d7bd",
  B: "#689cff",
};

let runtimePromise: Promise<EChartsRuntime> | null = null;

function loadECharts(): Promise<EChartsRuntime> {
  runtimePromise ??= import("./statistics-chart-runtime").then((module) => module.echarts);
  return runtimePromise;
}

function cssValue(style: CSSStyleDeclaration, name: string, fallback: string): string {
  return style.getPropertyValue(name).trim() || fallback;
}

function groupLabel(key: string): string {
  return key === "all" ? t("statistics.allCfa") : key;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

function histogramData(histogram: number[], maximumPoints = 4096): HistogramDatum[] {
  if (!histogram.length) return [];
  const bucketSize = Math.max(1, Math.ceil(histogram.length / maximumPoints));
  const data: HistogramDatum[] = [];
  for (let start = 0; start < histogram.length; start += bucketSize) {
    const end = Math.min(histogram.length - 1, start + bucketSize - 1);
    let count = 0;
    for (let index = start; index <= end; index += 1) count += histogram[index];
    data.push({
      value: [(start + end) / 2, count],
      dnStart: start,
      dnEnd: end,
    });
  }
  return data;
}

function tooltipParameters(value: unknown): TooltipSeriesParameter[] {
  if (Array.isArray(value)) return value as TooltipSeriesParameter[];
  return value && typeof value === "object" ? [value as TooltipSeriesParameter] : [];
}

function histogramTooltip(parameters: unknown): string {
  const items = tooltipParameters(parameters);
  if (!items.length) return "";
  const datum = items[0].data;
  const start = datum && !Array.isArray(datum) ? datum.dnStart : Math.round(items[0].value?.[0] ?? 0);
  const end = datum && !Array.isArray(datum) ? datum.dnEnd : start;
  const range = start === end ? `DN ${start}` : `DN ${start}–${end}`;
  const rows = items.map((item) => {
    const value = Array.isArray(item.data) ? item.data[1] : item.data?.value[1] ?? item.value?.[1] ?? 0;
    return `${item.marker ?? ""}${item.seriesName ?? ""}: ${formatNumber(value)}`;
  });
  return [range, ...rows].join("<br/>");
}

function profileData(points: ProfilePoint[], metric: ProfileMetric): Array<[number, number | null]> {
  return points.map((point) => [point.coordinate, point[metric]]);
}

function profileTooltip(parameters: unknown): string {
  const items = tooltipParameters(parameters);
  if (!items.length) return "";
  const firstValue = Array.isArray(items[0].data) ? items[0].data : items[0].value;
  const coordinate = firstValue?.[0] ?? 0;
  const rows = items.map((item) => {
    const value = Array.isArray(item.data) ? item.data[1] : item.value?.[1];
    return `${item.marker ?? ""}${item.seriesName ?? ""}: ${value === null || value === undefined ? "—" : formatNumber(value)}`;
  });
  return [`${t("statistics.sourceCoordinate")}: ${coordinate}`, ...rows].join("<br/>");
}

export class StatisticsCharts {
  private readonly root: HTMLElement;
  private readonly instances: ChartInstance[] = [];
  private renderRevision = 0;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  render(result: AnalysisResult, selectedKey: string): void {
    this.dispose();
    const revision = ++this.renderRevision;
    void this.renderLoaded(revision, result, selectedKey);
  }

  private async renderLoaded(
    revision: number,
    result: AnalysisResult,
    selectedKey: string,
  ): Promise<void> {
    const runtime = await loadECharts();
    if (revision !== this.renderRevision) return;
    const selected = result.groups.find((group) => group.key === selectedKey) ?? result.groups[0];
    const histogramElement = this.root.querySelector<HTMLElement>("[data-stat-chart='histogram']");
    const rowElement = this.root.querySelector<HTMLElement>("[data-stat-chart='row']");
    const columnElement = this.root.querySelector<HTMLElement>("[data-stat-chart='column']");
    for (const element of [histogramElement, rowElement, columnElement]) {
      if (element) this.releaseUnmodifiedWheel(element);
    }
    if (histogramElement) this.createHistogram(runtime, histogramElement, result, selected);
    if (rowElement) this.createProfile(runtime, rowElement, selected.rowProfile, "mean");
    if (columnElement) this.createProfile(runtime, columnElement, selected.columnProfile, "mean");
  }

  private releaseUnmodifiedWheel(element: HTMLElement): void {
    element.addEventListener("wheel", (event) => {
      if (event.ctrlKey) return;
      event.stopPropagation();
    }, { capture: true, passive: true });
  }

  resize(): void {
    this.instances.forEach((instance) => instance.resize());
  }

  resetZoom(): void {
    this.instances.forEach((instance) => {
      instance.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
    });
  }

  dispose(): void {
    this.renderRevision += 1;
    while (this.instances.length) this.instances.pop()?.dispose();
  }

  private commonOption(): ChartOption {
    const style = getComputedStyle(this.root);
    const text = cssValue(style, "--text", "#d7e3ea");
    const muted = cssValue(style, "--muted", "#91a5b2");
    const dim = cssValue(style, "--dim", "#6f818d");
    const border = cssValue(style, "--border", "rgba(128, 150, 164, .28)");
    const surface = cssValue(style, "--soft-fill", "rgba(128, 150, 164, .08)");
    return {
      animationDuration: 280,
      backgroundColor: "transparent",
      textStyle: {
        color: text,
        fontFamily: "system-ui, sans-serif",
      },
      grid: {
        left: 62,
        right: 28,
        top: 48,
        bottom: 72,
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        appendToBody: true,
        confine: true,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: surface,
        textStyle: { color: text, fontSize: 12 },
        axisPointer: {
          type: "cross",
          label: { color: text, backgroundColor: dim },
          lineStyle: { color: muted, type: "dashed" },
        },
      },
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          filterMode: "none",
          zoomOnMouseWheel: "ctrl",
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          height: 18,
          bottom: 14,
          borderColor: border,
          backgroundColor: surface,
          fillerColor: GROUP_COLORS.all + "28",
          handleStyle: { color: GROUP_COLORS.all, borderColor: GROUP_COLORS.all },
          textStyle: { color: dim, fontSize: 10 },
        },
      ],
      xAxis: {
        type: "value",
        nameLocation: "end",
        nameGap: 12,
        nameTextStyle: { color: muted },
        axisLabel: { color: dim, hideOverlap: true },
        axisLine: { lineStyle: { color: border } },
        axisTick: { lineStyle: { color: border } },
        splitLine: { lineStyle: { color: border, type: "dashed", opacity: 0.55 } },
      },
      yAxis: {
        type: "value",
        nameLocation: "middle",
        nameGap: 48,
        nameTextStyle: { color: muted },
        axisLabel: { color: dim, hideOverlap: true },
        axisLine: { show: true, lineStyle: { color: border } },
        axisTick: { lineStyle: { color: border } },
        splitLine: { lineStyle: { color: border, type: "dashed", opacity: 0.55 } },
      },
    };
  }

  private createHistogram(
    runtime: EChartsRuntime,
    element: HTMLElement,
    result: AnalysisResult,
    selected: GroupStatistics,
  ): void {
    const chart = runtime.init(element, undefined, { renderer: "canvas" });
    this.instances.push(chart);
    const comparison = selected.key === "all"
      ? result.groups.filter((group) => ["all", "R", "Gr", "Gb", "B"].includes(group.key))
      : [selected];
    const option: ChartOption = {
      ...this.commonOption(),
      legend: {
        top: 8,
        left: 62,
        textStyle: { color: cssValue(getComputedStyle(this.root), "--muted", "#91a5b2") },
        data: comparison.map((group) => groupLabel(group.key)),
      },
      tooltip: {
        ...(this.commonOption().tooltip as object),
        formatter: histogramTooltip,
      },
      xAxis: {
        ...(this.commonOption().xAxis as object),
        name: "DN",
        min: 0,
        max: 2 ** result.snapshot.bitDepth - 1,
      },
      yAxis: {
        ...(this.commonOption().yAxis as object),
        name: t("statistics.count"),
        min: 0,
      },
      series: comparison.map((group) => ({
        name: groupLabel(group.key),
        type: "line",
        data: histogramData(group.histogram),
        showSymbol: false,
        sampling: "lttb",
        connectNulls: false,
        lineStyle: {
          width: group.key === "all" ? 2.2 : 1.2,
          color: GROUP_COLORS[group.key] ?? GROUP_COLORS.all,
          opacity: group.key === "all" ? 1 : 0.78,
        },
        areaStyle: group.key === "all"
          ? { color: GROUP_COLORS.all + "18", opacity: 0.25 }
          : undefined,
        emphasis: { focus: "series" },
      })),
    };
    chart.setOption(option);
  }

  private createProfile(
    runtime: EChartsRuntime,
    element: HTMLElement,
    points: ProfilePoint[],
    metric: ProfileMetric,
  ): void {
    const chart = runtime.init(element, undefined, { renderer: "canvas" });
    this.instances.push(chart);
    const option: ChartOption = {
      ...this.commonOption(),
      tooltip: {
        ...(this.commonOption().tooltip as object),
        formatter: profileTooltip,
      },
      xAxis: {
        ...(this.commonOption().xAxis as object),
        name: t("statistics.sourceCoordinate"),
        min: "dataMin",
        max: "dataMax",
      },
      yAxis: {
        ...(this.commonOption().yAxis as object),
        name: metric === "mean" ? t("statistics.meanDn") : t("statistics.stdDevDn"),
        scale: true,
      },
      series: [{
        name: metric === "mean" ? t("statistics.meanDn") : t("statistics.stdDevDn"),
        type: "line",
        data: profileData(points, metric),
        showSymbol: false,
        sampling: "lttb",
        connectNulls: false,
        lineStyle: { width: 1.8, color: GROUP_COLORS.all },
        areaStyle: { color: GROUP_COLORS.all + "10", opacity: 0.18 },
        emphasis: { focus: "series" },
      }],
    };
    chart.setOption(option);
  }
}
