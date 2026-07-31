import { choosePngFile } from "./api";
import { copyCanvasImage, saveCanvasPng } from "./image-output";
import { t } from "./i18n";
import type {
  AnalysisResult,
  GroupStatistics,
  ProfilePoint,
  StatisticalSummary,
} from "./types";

export type StatisticsPanelAction =
  | "close"
  | "toggleDetached"
  | "selectRoi"
  | "clearRoi"
  | "useFullFrame"
  | "useSelection"
  | "cancelAnalysis";

export interface StatisticsPanelState {
  result: AnalysisResult | null;
  documentName: string | null;
  loading: boolean;
  error: string | null;
  hasSelection: boolean;
  useSelection: boolean;
}

interface StatisticsPanelOptions {
  detached: boolean;
  onAction(action: StatisticsPanelAction): void;
  onError(error: unknown): void;
  onNotify(message: string): void;
}

type StatisticsTab = "overview" | "histogram" | "profiles" | "report";
type ProfileMetric = "mean" | "standardDeviation";

const GROUP_COLORS: Record<string, string> = {
  all: "#5fc7e8",
  Y: "#d5e4ee",
  R: "#ef6680",
  G: "#72d995",
  Gr: "#a4e86f",
  Gb: "#50d7bd",
  B: "#689cff",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[character]!);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatValue(value: number | null, digits = 3): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

function prepareCanvas(canvas: HTMLCanvasElement, width?: number, height?: number): CanvasRenderingContext2D {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(320, width ?? rect.width);
  const cssHeight = Math.max(180, height ?? rect.height);
  const dpr = width ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(cssWidth * dpr);
  const pixelHeight = Math.round(cssHeight * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);
  return context;
}

function drawChartFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  xLabel: string,
  yLabel: string,
): { left: number; top: number; width: number; height: number } {
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#172634";
  context.font = "600 14px system-ui";
  context.fillText(title, 18, 23);
  const plot = { left: 58, top: 38, width: width - 78, height: height - 78 };
  context.strokeStyle = "#ccd7df";
  context.lineWidth = 1;
  context.strokeRect(plot.left, plot.top, plot.width, plot.height);
  context.fillStyle = "#647786";
  context.font = "11px system-ui";
  context.fillText(xLabel, plot.left + plot.width / 2 - 18, height - 12);
  context.save();
  context.translate(14, plot.top + plot.height / 2 + 18);
  context.rotate(-Math.PI / 2);
  context.fillText(yLabel, 0, 0);
  context.restore();
  return plot;
}

function downsampleHistogram(histogram: number[], width: number, cumulative: boolean): number[] {
  const target = Math.max(1, Math.floor(width));
  const values = new Array<number>(target).fill(0);
  for (let index = 0; index < histogram.length; index += 1) {
    const column = Math.min(target - 1, Math.floor(index / histogram.length * target));
    values[column] += histogram[index];
  }
  if (cumulative) {
    for (let index = 1; index < values.length; index += 1) values[index] += values[index - 1];
  }
  return values;
}

function drawHistogram(
  canvas: HTMLCanvasElement,
  result: AnalysisResult,
  selectedKey: string,
  cumulative: boolean,
  logarithmic: boolean,
  comparison: boolean,
  fixedSize?: { width: number; height: number },
): void {
  const width = fixedSize?.width ?? Math.max(320, canvas.clientWidth);
  const height = fixedSize?.height ?? Math.max(180, canvas.clientHeight);
  const context = prepareCanvas(canvas, fixedSize?.width, fixedSize?.height);
  const plot = drawChartFrame(
    context,
    width,
    height,
    cumulative ? t("statistics.histogramCumulative") : t("statistics.histogram"),
    "DN",
    logarithmic ? "log(count)" : "count",
  );
  const selected = result.groups.find((group) => group.key === selectedKey) ?? result.groups[0];
  const groups = comparison && selected.key === "all"
    ? result.groups.filter((group) => ["all", "R", "Gr", "Gb", "B"].includes(group.key))
    : [selected];
  const series = groups.map((group) => ({
    group,
    values: downsampleHistogram(group.histogram, plot.width, cumulative),
  }));
  const transformed = (value: number) => logarithmic ? Math.log10(value + 1) : value;
  const maximum = Math.max(1, ...series.flatMap((item) => item.values.map(transformed)));
  context.save();
  context.beginPath();
  context.rect(plot.left, plot.top, plot.width, plot.height);
  context.clip();
  for (const [seriesIndex, item] of series.entries()) {
    context.beginPath();
    item.values.forEach((value, index) => {
      const x = plot.left + index / Math.max(1, item.values.length - 1) * plot.width;
      const y = plot.top + plot.height - transformed(value) / maximum * plot.height;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.strokeStyle = GROUP_COLORS[item.group.key] ?? "#6a8ca3";
    context.lineWidth = item.group.key === "all" ? 2 : 1;
    context.globalAlpha = seriesIndex === 0 ? 1 : 0.82;
    context.stroke();
  }
  context.restore();
  context.globalAlpha = 1;
  context.fillStyle = "#647786";
  context.font = "10px ui-monospace, monospace";
  context.fillText("0", plot.left, plot.top + plot.height + 15);
  context.textAlign = "right";
  context.fillText(String(2 ** result.snapshot.bitDepth - 1), plot.left + plot.width, plot.top + plot.height + 15);
  context.textAlign = "left";
  let legendX = plot.left + 8;
  for (const item of series) {
    context.fillStyle = GROUP_COLORS[item.group.key] ?? "#6a8ca3";
    context.fillRect(legendX, plot.top + 8, 12, 2);
    context.fillStyle = "#405563";
    context.fillText(item.group.key === "all" ? "All CFA" : item.group.key, legendX + 16, plot.top + 12);
    legendX += 58;
  }
}

function validProfile(points: ProfilePoint[], metric: ProfileMetric): Array<{ x: number; y: number }> {
  return points.flatMap((point) => {
    const value = point[metric];
    return value === null ? [] : [{ x: point.coordinate, y: value }];
  });
}

function drawProfile(
  canvas: HTMLCanvasElement,
  points: ProfilePoint[],
  title: string,
  metric: ProfileMetric,
  fixedSize?: { width: number; height: number },
): void {
  const width = fixedSize?.width ?? Math.max(320, canvas.clientWidth);
  const height = fixedSize?.height ?? Math.max(180, canvas.clientHeight);
  const context = prepareCanvas(canvas, fixedSize?.width, fixedSize?.height);
  const plot = drawChartFrame(
    context,
    width,
    height,
    title,
    t("statistics.sourceCoordinate"),
    metric === "mean" ? t("statistics.meanDn") : t("statistics.stdDevDn"),
  );
  const values = validProfile(points, metric);
  if (!values.length) return;
  const minX = values[0].x;
  const maxX = values[values.length - 1].x;
  const minY = Math.min(...values.map((point) => point.y));
  const maxY = Math.max(...values.map((point) => point.y));
  context.beginPath();
  for (const [index, point] of values.entries()) {
    const x = plot.left + (point.x - minX) / Math.max(1, maxX - minX) * plot.width;
    const y = plot.top + plot.height - (point.y - minY) / Math.max(1e-9, maxY - minY) * plot.height;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.strokeStyle = GROUP_COLORS.all;
  context.lineWidth = 1.5;
  context.stroke();
  context.fillStyle = "#647786";
  context.font = "10px ui-monospace, monospace";
  context.fillText(formatValue(minY), plot.left + 4, plot.top + plot.height - 5);
  context.fillText(formatValue(maxY), plot.left + 4, plot.top + 12);
}

function summaryRows(summary: StatisticalSummary): Array<[string, string]> {
  return [
    [t("statistics.expected"), formatInteger(summary.expectedCount)],
    [t("statistics.valid"), formatInteger(summary.validCount)],
    [t("statistics.missing"), formatInteger(summary.missingCount)],
    ["Min / Max DN", `${formatValue(summary.minimum, 0)} / ${formatValue(summary.maximum, 0)}`],
    ["Mean / Median DN", `${formatValue(summary.mean)} / ${formatValue(summary.median, 0)}`],
    ["Mode DN", formatValue(summary.mode, 0)],
    ["Variance / StdDev", `${formatValue(summary.variance)} / ${formatValue(summary.standardDeviation)}`],
    ["P1 / P5 / P95 / P99", `${formatValue(summary.p1, 0)} / ${formatValue(summary.p5, 0)} / ${formatValue(summary.p95, 0)} / ${formatValue(summary.p99, 0)}`],
    ["Zero / Full-scale DN", `${formatInteger(summary.zeroCount)} / ${formatInteger(summary.fullScaleCount)}`],
  ];
}

export class StatisticsPanel {
  private readonly root: HTMLElement;
  private readonly options: StatisticsPanelOptions;
  private state: StatisticsPanelState = {
    result: null,
    documentName: null,
    loading: false,
    error: null,
    hasSelection: false,
    useSelection: false,
  };
  private activeTab: StatisticsTab = "overview";
  private selectedGroup = "all";
  private cumulative = false;
  private logarithmic = false;
  private profileMetric: ProfileMetric = "mean";
  private readonly resizeObserver: ResizeObserver;

  constructor(root: HTMLElement, options: StatisticsPanelOptions) {
    this.root = root;
    this.options = options;
    this.root.classList.toggle("detached", options.detached);
    this.resizeObserver = new ResizeObserver(() => this.drawCharts());
    this.resizeObserver.observe(root);
    this.render();
  }

  setState(state: StatisticsPanelState): void {
    this.state = state;
    if (!state.result?.groups.some((group) => group.key === this.selectedGroup)) {
      this.selectedGroup = "all";
    }
    this.render();
  }

  resetView(): void {
    this.activeTab = "overview";
    this.selectedGroup = "all";
    this.cumulative = false;
    this.logarithmic = false;
    this.profileMetric = "mean";
    this.render();
  }

  private render(): void {
    const result = this.state.result;
    const selected = result?.groups.find((group) => group.key === this.selectedGroup) ?? result?.groups[0];
    const roi = result?.snapshot.roi;
    const rangeText = roi
      ? `${roi.x}, ${roi.y} · ${roi.width} × ${roi.height}`
      : t("statistics.noData");
    this.root.innerHTML = `
      <header class="statistics-header">
        <div class="statistics-title"><strong>${t("statistics.title")}</strong><span>${this.state.documentName ? escapeHtml(this.state.documentName) : t("statistics.noFile")}</span></div>
        <div class="statistics-header-actions">
          <button type="button" data-stat-action="reset">${t("statistics.resetView")}</button>
          <button type="button" data-stat-action="toggleDetached">${this.options.detached ? t("statistics.dock") : t("statistics.detach")}</button>
          <button type="button" data-stat-action="close" title="${t("common.close")}">×</button>
        </div>
      </header>
      <div class="statistics-toolbar">
        <div class="statistics-range" role="group">
          <span>${t("statistics.range")}</span>
          <button type="button" data-stat-action="useFullFrame" class="${this.state.useSelection ? "" : "active"}">${t("statistics.fullFrame")}</button>
          <button type="button" data-stat-action="useSelection" class="${this.state.useSelection ? "active" : ""}" ${this.state.hasSelection ? "" : "disabled"}>${t("statistics.selection")}</button>
          <button type="button" data-stat-action="selectRoi">${t("statistics.selectRegion")}</button>
          <button type="button" data-stat-action="clearRoi" ${this.state.hasSelection ? "" : "disabled"}>${t("statistics.clearSelection")}</button>
          <small>${rangeText}</small>
        </div>
        <nav class="statistics-tabs">
          ${(["overview", "histogram", "profiles", "report"] as StatisticsTab[]).map((tab) => `<button type="button" data-stat-tab="${tab}" class="${tab === this.activeTab ? "active" : ""}">${t(`statistics.tab.${tab}` as Parameters<typeof t>[0])}</button>`).join("")}
        </nav>
      </div>
      <div class="statistics-body">
        ${this.renderBody(selected)}
      </div>`;
    this.bindEvents();
    window.requestAnimationFrame(() => this.drawCharts());
  }

  private renderBody(selected: GroupStatistics | undefined): string {
    if (!this.state.documentName) return `<div class="statistics-empty">${t("statistics.openFileHint")}</div>`;
    if (this.state.loading && !this.state.result) {
      return `<div class="statistics-empty busy"><i></i><strong>${t("statistics.calculating")}</strong><button type="button" data-stat-action="cancelAnalysis">${t("common.cancel")}</button></div>`;
    }
    if (this.state.error) return `<div class="statistics-empty error">${escapeHtml(this.state.error)}</div>`;
    if (!selected || !this.state.result) return `<div class="statistics-empty">${t("statistics.noData")}</div>`;
    const channelSelector = `<div class="statistics-channels">${this.state.result.groups.map((group) => `<button type="button" data-stat-group="${group.key}" class="${group.key === selected.key ? "active" : ""}">${group.key === "all" ? "All CFA" : group.key}</button>`).join("")}</div>`;
    const summary = `<div class="statistics-summary">${summaryRows(selected.summary).map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>`;
    if (this.activeTab === "histogram") {
      return `${channelSelector}<div class="statistics-chart-controls"><label><input type="checkbox" data-stat-option="cumulative" ${this.cumulative ? "checked" : ""}/> ${t("statistics.cumulative")}</label><label><input type="checkbox" data-stat-option="logarithmic" ${this.logarithmic ? "checked" : ""}/> ${t("statistics.logScale")}</label>${this.outputButtons("histogram")}</div><canvas class="statistics-chart statistics-histogram"></canvas>`;
    }
    if (this.activeTab === "profiles") {
      return `${channelSelector}<div class="statistics-chart-controls"><select data-stat-option="profileMetric"><option value="mean" ${this.profileMetric === "mean" ? "selected" : ""}>${t("statistics.mean")}</option><option value="standardDeviation" ${this.profileMetric === "standardDeviation" ? "selected" : ""}>${t("statistics.standardDeviation")}</option></select></div><div class="statistics-profile-grid"><section class="statistics-profile-card"><header><strong>${t("statistics.rowProfile")}</strong>${this.outputButtons("row")}</header><canvas class="statistics-chart statistics-row-profile"></canvas></section><section class="statistics-profile-card"><header><strong>${t("statistics.columnProfile")}</strong>${this.outputButtons("column")}</header><canvas class="statistics-chart statistics-column-profile"></canvas></section></div>`;
    }
    if (this.activeTab === "report") {
      return `<div class="statistics-report-actions">${this.outputButtons("report")}</div><canvas class="statistics-report-preview"></canvas><p class="statistics-disclaimer">${t("statistics.disclaimer")}</p>`;
    }
    return `${channelSelector}<div class="statistics-overview-grid"><section>${summary}</section><section><canvas class="statistics-chart statistics-histogram"></canvas></section><section><canvas class="statistics-chart statistics-row-profile"></canvas></section><section><canvas class="statistics-chart statistics-column-profile"></canvas></section></div>`;
  }

  private outputButtons(kind: "histogram" | "row" | "column" | "report"): string {
    return `<span class="statistics-output-actions"><button type="button" data-stat-output="${kind}:copy">${kind === "report" ? t("statistics.copyReport") : t("statistics.copyChart")}</button><button type="button" data-stat-output="${kind}:save">${kind === "report" ? t("statistics.saveReport") : t("statistics.saveChart")}</button></span>`;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-stat-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.statAction;
        if (action === "reset") {
          this.resetView();
          return;
        }
        this.options.onAction(action as StatisticsPanelAction);
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-stat-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        this.activeTab = button.dataset.statTab as StatisticsTab;
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-stat-group]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedGroup = button.dataset.statGroup ?? "all";
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLInputElement>("[data-stat-option]").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.dataset.statOption === "cumulative") this.cumulative = input.checked;
        if (input.dataset.statOption === "logarithmic") this.logarithmic = input.checked;
        this.drawCharts();
      });
    });
    this.root.querySelector<HTMLSelectElement>('[data-stat-option="profileMetric"]')?.addEventListener("change", (event) => {
      this.profileMetric = (event.currentTarget as HTMLSelectElement).value as ProfileMetric;
      this.drawCharts();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-stat-output]").forEach((button) => {
      button.addEventListener("click", () => void this.output(button.dataset.statOutput ?? ""));
    });
  }

  private drawCharts(): void {
    const result = this.state.result;
    if (!result) return;
    const selected = result.groups.find((group) => group.key === this.selectedGroup) ?? result.groups[0];
    this.root.querySelectorAll<HTMLCanvasElement>(".statistics-histogram").forEach((canvas) => {
      drawHistogram(canvas, result, selected.key, this.cumulative, this.logarithmic, true);
    });
    this.root.querySelectorAll<HTMLCanvasElement>(".statistics-row-profile").forEach((canvas) => {
      drawProfile(canvas, selected.rowProfile, t("statistics.rowProfile"), this.profileMetric);
    });
    this.root.querySelectorAll<HTMLCanvasElement>(".statistics-column-profile").forEach((canvas) => {
      drawProfile(canvas, selected.columnProfile, t("statistics.columnProfile"), this.profileMetric);
    });
    this.root.querySelectorAll<HTMLCanvasElement>(".statistics-report-preview").forEach((canvas) => {
      this.drawReport(canvas, 960, 540);
    });
  }

  private createChart(kind: "histogram" | "row" | "column"): HTMLCanvasElement {
    const result = this.state.result!;
    const selected = result.groups.find((group) => group.key === this.selectedGroup) ?? result.groups[0];
    const canvas = document.createElement("canvas");
    if (kind === "histogram") {
      drawHistogram(canvas, result, selected.key, this.cumulative, this.logarithmic, true, { width: 1600, height: 900 });
      return canvas;
    }
    drawProfile(
      canvas,
      kind === "row" ? selected.rowProfile : selected.columnProfile,
      kind === "row" ? t("statistics.rowProfile") : t("statistics.columnProfile"),
      this.profileMetric,
      { width: 1600, height: 900 },
    );
    return canvas;
  }

  private drawReport(canvas: HTMLCanvasElement, width = 1920, height = 1080): void {
    const result = this.state.result;
    if (!result) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    const scale = width / 1920;
    context.save();
    context.scale(scale, scale);
    context.fillStyle = "#f7fafc";
    context.fillRect(0, 0, 1920, 1080);
    context.fillStyle = "#112635";
    context.font = "700 34px system-ui";
    context.fillText(t("statistics.reportTitle"), 64, 68);
    context.fillStyle = "#607381";
    context.font = "16px system-ui";
    const roi = result.snapshot.roi;
    context.fillText(
      `${this.state.documentName ?? ""} · Frame ${result.snapshot.frame + 1} · ${result.snapshot.width}×${result.snapshot.height} · ${result.snapshot.packing} ${result.snapshot.bitDepth} bit · ${result.snapshot.cfa} Phase ${result.snapshot.cfaPhaseX}/${result.snapshot.cfaPhaseY} · ROI ${roi.x},${roi.y} ${roi.width}×${roi.height}`,
      64,
      100,
    );
    const all = result.groups[0];
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#d5e0e7";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(64, 132, 430, 780, 12);
    context.fill();
    context.stroke();
    context.fillStyle = "#1d3545";
    context.font = "650 18px system-ui";
    context.fillText("All CFA", 90, 172);
    context.font = "14px system-ui";
    summaryRows(all.summary).forEach(([label, value], index) => {
      const y = 210 + index * 48;
      context.fillStyle = "#738491";
      context.fillText(label, 90, y);
      context.fillStyle = "#173041";
      context.font = "600 16px ui-monospace, monospace";
      context.fillText(value, 90, y + 21);
      context.font = "14px system-ui";
    });
    const comparisonGroups = result.groups.filter((group) => ["R", "Gr", "Gb", "B", "Y"].includes(group.key));
    context.fillStyle = "#1d3545";
    context.font = "650 15px system-ui";
    context.fillText(t("statistics.channelComparison"), 90, 660);
    context.fillStyle = "#738491";
    context.font = "11px system-ui";
    context.fillText("CFA", 90, 686);
    context.fillText("Mean", 145, 686);
    context.fillText("StdDev", 245, 686);
    context.fillText("Zero / FS", 350, 686);
    comparisonGroups.forEach((group, index) => {
      const y = 715 + index * 34;
      context.fillStyle = GROUP_COLORS[group.key] ?? "#456273";
      context.font = "650 12px ui-monospace, monospace";
      context.fillText(group.key, 90, y);
      context.fillStyle = "#173041";
      context.font = "12px ui-monospace, monospace";
      context.fillText(formatValue(group.summary.mean), 145, y);
      context.fillText(formatValue(group.summary.standardDeviation), 245, y);
      context.fillText(`${formatInteger(group.summary.zeroCount)} / ${formatInteger(group.summary.fullScaleCount)}`, 350, y);
    });
    const histogram = document.createElement("canvas");
    drawHistogram(histogram, result, "all", false, false, true, { width: 1320, height: 430 });
    context.drawImage(histogram, 536, 132);
    const rowCanvas = document.createElement("canvas");
    const columnCanvas = document.createElement("canvas");
    drawProfile(rowCanvas, all.rowProfile, t("statistics.rowProfile"), "mean", { width: 640, height: 330 });
    drawProfile(columnCanvas, all.columnProfile, t("statistics.columnProfile"), "mean", { width: 640, height: 330 });
    context.drawImage(rowCanvas, 536, 582);
    context.drawImage(columnCanvas, 1216, 582);
    context.fillStyle = "#6d7e8a";
    context.font = "13px system-ui";
    context.fillText(t("statistics.disclaimer"), 64, 1018);
    context.restore();
  }

  private async output(specification: string): Promise<void> {
    if (!this.state.result) return;
    const [kind, destination] = specification.split(":") as ["histogram" | "row" | "column" | "report", "copy" | "save"];
    try {
      const canvas = kind === "report" ? document.createElement("canvas") : this.createChart(kind);
      if (kind === "report") this.drawReport(canvas);
      if (destination === "copy") {
        await copyCanvasImage(canvas);
        this.options.onNotify(t(kind === "report" ? "statistics.reportCopied" : "statistics.chartCopied"));
        return;
      }
      const baseName = (this.state.documentName ?? "eRAW").replace(/\.[^.]+$/, "");
      const path = await choosePngFile(`${baseName}-${kind}.png`);
      if (path) {
        await saveCanvasPng(canvas, path);
        this.options.onNotify(t(kind === "report" ? "statistics.reportSaved" : "statistics.chartSaved"));
      }
    } catch (error) {
      this.options.onError(error);
    }
  }
}
