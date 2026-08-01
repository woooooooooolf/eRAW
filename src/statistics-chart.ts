import { t } from "./i18n";
import type {
  AnalysisResult,
  GroupStatistics,
  ProfilePoint,
} from "./types";
import {
  normalizeStatisticsRange,
  type StatisticsAxisRange,
  type StatisticsChartKey,
  type StatisticsViewState,
} from "./statistics-view-state";

type EChartsRuntime = typeof import("./statistics-chart-runtime")["echarts"];
type ChartInstance = ReturnType<EChartsRuntime["init"]>;
type ChartOption = Parameters<ChartInstance["setOption"]>[0];
type ProfileMetric = "mean" | "standardDeviation";
type StatisticsAxis = "x" | "y";

interface HistogramDatum {
  value: [number, number];
  dnStart: number;
  dnEnd: number;
}

interface TooltipSeriesParameter {
  marker?: string;
  seriesName?: string;
  data?: HistogramDatum | [number, number | null];
  value?: [number, number | null];
}

interface ChartDomains {
  x: StatisticsAxisRange;
  y: StatisticsAxisRange;
}

interface DataZoomEventItem {
  dataZoomId?: string;
  dataZoomIndex?: number;
  start?: number;
  end?: number;
}

interface DataZoomEvent extends DataZoomEventItem {
  batch?: DataZoomEventItem[];
}

interface StatisticsChartCallbacks {
  onRangeChange(chart: StatisticsChartKey, axis: StatisticsAxis, range: StatisticsAxisRange | null): void;
}

let runtimePromise: Promise<EChartsRuntime> | null = null;

function loadECharts(): Promise<EChartsRuntime> {
  runtimePromise ??= import("./statistics-chart-runtime").then((module) => module.echarts);
  return runtimePromise;
}

function cssValue(style: CSSStyleDeclaration, name: string, fallback: string): string {
  return style.getPropertyValue(name).trim() || fallback;
}

function rgbVariable(style: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = cssValue(style, name, fallback).replace(/,/g, " ").trim();
  return `rgb(${value})`;
}

function mixRgb(left: string, right: string, ratio: number): string {
  const values = (value: string) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [128, 128, 128];
  const a = values(left);
  const b = values(right);
  return `rgb(${a.map((value, index) => Math.round(value * (1 - ratio) + b[index] * ratio)).join(" ")})`;
}

function groupColors(root: HTMLElement): Record<string, string> {
  const style = getComputedStyle(root);
  const red = rgbVariable(style, "--channel-red-rgb", "239 91 111");
  const green = rgbVariable(style, "--channel-green-rgb", "68 196 126");
  const blue = rgbVariable(style, "--channel-blue-rgb", "76 137 241");
  const accent = rgbVariable(style, "--accent-rgb", "82 202 244");
  return {
    all: accent,
    Y: cssValue(style, "--text", "#d7e3ea"),
    R: red,
    G: green,
    Gr: mixRgb(green, accent, 0.22),
    Gb: mixRgb(green, blue, 0.28),
    B: blue,
  };
}

export function groupLabel(key: string): string {
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
    data.push({ value: [(start + end) / 2, count], dnStart: start, dnEnd: end });
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
    return `${item.marker ?? ""}${item.seriesName ?? ""}: ${formatNumber(Number(value ?? 0))}`;
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

function availableGroups(result: AnalysisResult): GroupStatistics[] {
  if (result.snapshot.cfa === "MONO") {
    return [result.groups.find((group) => group.key === "Y") ?? result.groups[0]];
  }
  return result.groups;
}

function profileDomain(groups: GroupStatistics[], axis: "rowProfile" | "columnProfile"): StatisticsAxisRange {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const group of groups) {
    for (const point of group[axis]) {
      if (point.mean === null) continue;
      start = Math.min(start, point.mean);
      end = Math.max(end, point.mean);
    }
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { start: 0, end: 1 };
  if (start === end) return { start: Math.max(0, start - 1), end: end + 1 };
  const padding = Math.max(0.5, (end - start) * 0.04);
  return { start: Math.max(0, start - padding), end: end + padding };
}

export class StatisticsCharts {
  private readonly root: HTMLElement;
  private readonly callbacks: StatisticsChartCallbacks;
  private readonly instances = new Map<StatisticsChartKey, ChartInstance>();
  private readonly domains = new Map<StatisticsChartKey, ChartDomains>();
  private renderRevision = 0;

  constructor(root: HTMLElement, callbacks: StatisticsChartCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
  }

  render(result: AnalysisResult, viewState: StatisticsViewState): void {
    this.dispose();
    const revision = ++this.renderRevision;
    void this.renderLoaded(revision, result, viewState);
  }

  private async renderLoaded(revision: number, result: AnalysisResult, viewState: StatisticsViewState): Promise<void> {
    const runtime = await loadECharts();
    if (revision !== this.renderRevision) return;
    const groups = availableGroups(result);
    const histogramElement = this.root.querySelector<HTMLElement>("[data-stat-chart='histogram']");
    const rowElement = this.root.querySelector<HTMLElement>("[data-stat-chart='row']");
    const columnElement = this.root.querySelector<HTMLElement>("[data-stat-chart='column']");
    for (const element of [histogramElement, rowElement, columnElement]) {
      if (element) this.releaseUnmodifiedWheel(element);
    }
    if (histogramElement) this.createHistogram(runtime, histogramElement, result, groups, viewState);
    if (rowElement) this.createProfile(runtime, rowElement, "row", groups, "rowProfile", viewState);
    if (columnElement) this.createProfile(runtime, columnElement, "column", groups, "columnProfile", viewState);
  }

  private releaseUnmodifiedWheel(element: HTMLElement): void {
    element.addEventListener("wheel", (event) => {
      if (event.ctrlKey || event.shiftKey) return;
      event.stopPropagation();
    }, { capture: true, passive: true });
  }

  resize(): void {
    this.instances.forEach((instance) => instance.resize());
  }

  applyXRange(chartKey: StatisticsChartKey, range: StatisticsAxisRange | null): void {
    const instance = this.instances.get(chartKey);
    const domain = this.domains.get(chartKey)?.x;
    if (!instance || !domain) return;
    const normalized = normalizeStatisticsRange(range, domain.start, domain.end);
    instance.dispatchAction(normalized
      ? { type: "dataZoom", dataZoomId: `${chartKey}-x-slider`, startValue: normalized.start, endValue: normalized.end }
      : { type: "dataZoom", dataZoomId: `${chartKey}-x-slider`, start: 0, end: 100 });
    this.callbacks.onRangeChange(chartKey, "x", normalized);
    this.updateRangeInputs(chartKey, normalized ?? domain);
  }

  resetYRange(chartKey: StatisticsChartKey): void {
    const instance = this.instances.get(chartKey);
    if (!instance) return;
    instance.dispatchAction({ type: "dataZoom", dataZoomId: `${chartKey}-y-slider`, start: 0, end: 100 });
    this.callbacks.onRangeChange(chartKey, "y", null);
  }

  setGroupVisible(chartKey: StatisticsChartKey, groupKey: string, visible: boolean): void {
    const instance = this.instances.get(chartKey);
    if (!instance) return;
    instance.dispatchAction({
      type: visible ? "legendSelect" : "legendUnSelect",
      name: groupLabel(groupKey),
    });
  }

  dispose(): void {
    this.renderRevision += 1;
    this.instances.forEach((instance) => instance.dispose());
    this.instances.clear();
    this.domains.clear();
  }

  private commonOption(colors: Record<string, string>): ChartOption {
    const style = getComputedStyle(this.root);
    const text = cssValue(style, "--text", "#d7e3ea");
    const muted = cssValue(style, "--muted", "#91a5b2");
    const dim = cssValue(style, "--dim", "#6f818d");
    const border = cssValue(style, "--border", "rgba(128, 150, 164, .28)");
    const surface = cssValue(style, "--modal-surface", "#17222b");
    return {
      animationDuration: 280,
      backgroundColor: "transparent",
      color: Object.values(colors),
      textStyle: { color: text, fontFamily: "system-ui, sans-serif" },
      grid: { left: 62, right: 54, top: 38, bottom: 66, containLabel: false },
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

  private dataZoom(
    chartKey: StatisticsChartKey,
    xRange: StatisticsAxisRange | null,
    yRange: StatisticsAxisRange | null,
    colors: Record<string, string>,
  ): NonNullable<ChartOption["dataZoom"]> {
    const style = getComputedStyle(this.root);
    const border = cssValue(style, "--border", "rgba(128, 150, 164, .28)");
    const surface = cssValue(style, "--soft-fill", "rgba(128, 150, 164, .08)");
    const dim = cssValue(style, "--dim", "#6f818d");
    const range = (value: StatisticsAxisRange | null) => value
      ? { startValue: value.start, endValue: value.end }
      : { start: 0, end: 100 };
    return [
      {
        id: `${chartKey}-x-inside`, type: "inside", xAxisIndex: 0, filterMode: "none",
        zoomOnMouseWheel: "ctrl", moveOnMouseMove: true, moveOnMouseWheel: false, ...range(xRange),
      },
      {
        id: `${chartKey}-x-slider`, type: "slider", xAxisIndex: 0, filterMode: "none",
        height: 16, bottom: 12, borderColor: border, backgroundColor: surface,
        fillerColor: colors.all.replace("rgb(", "rgb(").replace(")", " / .16)"),
        handleStyle: { color: colors.all, borderColor: colors.all },
        textStyle: { color: dim, fontSize: 9 }, showDetail: false, ...range(xRange),
      },
      {
        id: `${chartKey}-y-inside`, type: "inside", yAxisIndex: 0, filterMode: "none",
        zoomOnMouseWheel: "shift", moveOnMouseMove: false, moveOnMouseWheel: false, ...range(yRange),
      },
      {
        id: `${chartKey}-y-slider`, type: "slider", yAxisIndex: 0, orient: "vertical", filterMode: "none",
        width: 14, right: 8, top: 38, bottom: 66, borderColor: border, backgroundColor: surface,
        fillerColor: colors.all.replace("rgb(", "rgb(").replace(")", " / .12)"),
        handleStyle: { color: colors.all, borderColor: colors.all },
        textStyle: { color: dim, fontSize: 9 }, showDetail: false, ...range(yRange),
      },
    ];
  }

  private registerChart(
    chartKey: StatisticsChartKey,
    chart: ChartInstance,
    domains: ChartDomains,
  ): void {
    this.instances.set(chartKey, chart);
    this.domains.set(chartKey, domains);
    chart.on("datazoom", (event: unknown) => this.handleDataZoom(chartKey, event as DataZoomEvent));
  }

  private handleDataZoom(chartKey: StatisticsChartKey, event: DataZoomEvent): void {
    const domains = this.domains.get(chartKey);
    if (!domains) return;
    for (const item of event.batch ?? [event]) {
      const axis: StatisticsAxis = item.dataZoomId?.includes("-y-")
        || item.dataZoomIndex === 2
        || item.dataZoomIndex === 3
        ? "y"
        : "x";
      if (!Number.isFinite(item.start) || !Number.isFinite(item.end)) continue;
      const domain = domains[axis];
      const start = domain.start + (domain.end - domain.start) * Number(item.start) / 100;
      const end = domain.start + (domain.end - domain.start) * Number(item.end) / 100;
      const normalized = normalizeStatisticsRange({ start, end }, domain.start, domain.end);
      this.callbacks.onRangeChange(chartKey, axis, normalized);
      if (axis === "x") this.updateRangeInputs(chartKey, normalized ?? domain);
    }
  }

  private updateRangeInputs(chartKey: StatisticsChartKey, range: StatisticsAxisRange): void {
    const start = this.root.querySelector<HTMLInputElement>(`[data-stat-range-chart="${chartKey}"][data-stat-range-edge="start"]`);
    const end = this.root.querySelector<HTMLInputElement>(`[data-stat-range-chart="${chartKey}"][data-stat-range-edge="end"]`);
    if (start) start.value = String(Math.round(range.start));
    if (end) end.value = String(Math.round(range.end));
  }

  private createHistogram(
    runtime: EChartsRuntime,
    element: HTMLElement,
    result: AnalysisResult,
    groups: GroupStatistics[],
    viewState: StatisticsViewState,
  ): void {
    const chartKey: StatisticsChartKey = "histogram";
    const colors = groupColors(this.root);
    const maximum = 2 ** result.snapshot.bitDepth - 1;
    const yMaximum = Math.max(1, ...groups.flatMap((group) => group.histogram));
    const domains = { x: { start: 0, end: maximum }, y: { start: 0, end: yMaximum } };
    const state = viewState.charts[chartKey];
    state.xRange = normalizeStatisticsRange(state.xRange, domains.x.start, domains.x.end);
    state.yRange = normalizeStatisticsRange(state.yRange, domains.y.start, domains.y.end);
    const visible = new Set(state.visibleGroups ?? groups.map((group) => group.key));
    const padding = Math.max(1, maximum * 0.006);
    const chart = runtime.init(element, undefined, { renderer: "canvas" });
    this.registerChart(chartKey, chart, domains);
    const common = this.commonOption(colors);
    chart.setOption({
      ...common,
      legend: {
        show: false,
        selected: Object.fromEntries(groups.map((group) => [groupLabel(group.key), visible.has(group.key)])),
      },
      tooltip: { ...(common.tooltip as object), formatter: histogramTooltip },
      dataZoom: this.dataZoom(chartKey, state.xRange, state.yRange, colors),
      xAxis: {
        ...(common.xAxis as object), name: "DN", min: -padding, max: maximum + padding,
        axisLabel: {
          ...((common.xAxis as { axisLabel?: object }).axisLabel ?? {}),
          formatter: (value: number) => value < 0 || value > maximum ? "" : formatNumber(value),
        },
      },
      yAxis: { ...(common.yAxis as object), name: t("statistics.count"), min: 0, max: yMaximum },
      series: groups.map((group) => {
        const width = group.key === "all" ? 2.4 : group.key === "G" ? 2 : 1.35;
        const opacity = group.key === "all" ? 1 : 0.86;
        return {
          name: groupLabel(group.key),
          type: "line",
          data: histogramData(group.histogram),
          showSymbol: false,
          sampling: "lttb",
          connectNulls: false,
          lineStyle: {
            width,
            type: group.key === "all" ? "solid" : group.key === "G" ? "dashed" : "solid",
            color: colors[group.key] ?? colors.all,
            opacity,
          },
          emphasis: { lineStyle: { width: width + 0.7, opacity: 1 } },
          blur: { lineStyle: { opacity } },
        };
      }),
    });
    this.updateRangeInputs(chartKey, state.xRange ?? domains.x);
  }

  private createProfile(
    runtime: EChartsRuntime,
    element: HTMLElement,
    chartKey: "row" | "column",
    groups: GroupStatistics[],
    profile: "rowProfile" | "columnProfile",
    viewState: StatisticsViewState,
  ): void {
    const colors = groupColors(this.root);
    const coordinates = groups.flatMap((group) => group[profile].map((point) => point.coordinate));
    const xDomain = {
      start: Math.min(...coordinates),
      end: Math.max(...coordinates),
    };
    const domains = { x: xDomain, y: profileDomain(groups, profile) };
    const state = viewState.charts[chartKey];
    state.xRange = normalizeStatisticsRange(state.xRange, domains.x.start, domains.x.end);
    state.yRange = normalizeStatisticsRange(state.yRange, domains.y.start, domains.y.end);
    const visible = new Set(state.visibleGroups ?? groups.map((group) => group.key));
    const chart = runtime.init(element, undefined, { renderer: "canvas" });
    this.registerChart(chartKey, chart, domains);
    const common = this.commonOption(colors);
    chart.setOption({
      ...common,
      legend: {
        show: false,
        selected: Object.fromEntries(groups.map((group) => [groupLabel(group.key), visible.has(group.key)])),
      },
      tooltip: { ...(common.tooltip as object), formatter: profileTooltip },
      dataZoom: this.dataZoom(chartKey, state.xRange, state.yRange, colors),
      xAxis: {
        ...(common.xAxis as object), name: chartKey === "row" ? "Y" : "X", min: xDomain.start, max: xDomain.end,
      },
      yAxis: {
        ...(common.yAxis as object), name: t("statistics.meanDn"), min: domains.y.start, max: domains.y.end,
      },
      series: groups.map((group) => {
        const width = group.key === "all" ? 2.3 : group.key === "G" ? 1.9 : 1.3;
        const opacity = group.key === "all" ? 1 : 0.86;
        return {
          name: groupLabel(group.key),
          type: "line",
          data: profileData(group[profile], "mean"),
          showSymbol: false,
          sampling: "lttb",
          connectNulls: true,
          lineStyle: {
            width,
            type: group.key === "all" ? "solid" : group.key === "G" ? "dashed" : "solid",
            color: colors[group.key] ?? colors.all,
            opacity,
          },
          emphasis: { lineStyle: { width: width + 0.7, opacity: 1 } },
          blur: { lineStyle: { opacity } },
        };
      }),
    });
    this.updateRangeInputs(chartKey, state.xRange ?? domains.x);
  }
}
