import { t } from "./i18n";
import { StatisticsCharts, groupLabel } from "./statistics-chart";
import {
  DEFAULT_STATISTICS_CHART_HEIGHT,
  loadStatisticsViewState,
  normalizeManualStatisticsRange,
  normalizeStatisticsRange,
  resetStatisticsViewState,
  saveStatisticsViewState,
  STATISTICS_CHART_KEYS,
  type StatisticsAxisRange,
  type StatisticsChartKey,
  type StatisticsLayout,
  type StatisticsViewState,
} from "./statistics-view-state";
import type {
  AnalysisResult,
  GroupStatistics,
  StatisticalSummary,
} from "./types";
import type { ImageRect } from "./viewport-transform";

export type StatisticsPanelAction =
  | "close"
  | "detach"
  | "dock"
  | "toggleDockPlacement"
  | "cancelAnalysis";

export interface StatisticsWindowActionMessage {
  action: StatisticsPanelAction;
  source: "detached";
}

export interface StatisticsPanelState {
  result: AnalysisResult | null;
  documentName: string | null;
  loading: boolean;
  error: string | null;
  roi: ImageRect | null;
  imageWidth: number;
  imageHeight: number;
  sideDockAvailable: boolean;
}

interface StatisticsPanelOptions {
  detached: boolean;
  layout?: StatisticsLayout;
  onAction(action: StatisticsPanelAction): void;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;",
  })[character]!);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatValue(value: number | null, digits = 3): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

function summaryRows(summary: StatisticalSummary): Array<[string, string]> {
  return [
    [t("statistics.minimumMaximumDn"), `${formatValue(summary.minimum, 0)} / ${formatValue(summary.maximum, 0)}`],
    [t("statistics.meanMedianDn"), `${formatValue(summary.mean)} / ${formatValue(summary.median, 0)}`],
    [t("statistics.modeDn"), formatValue(summary.mode, 0)],
    [t("statistics.varianceStdDev"), `${formatValue(summary.variance)} / ${formatValue(summary.standardDeviation)}`],
    [t("statistics.percentiles"), `${formatValue(summary.p1, 0)} / ${formatValue(summary.p5, 0)} / ${formatValue(summary.p95, 0)} / ${formatValue(summary.p99, 0)}`],
    [t("statistics.zeroFullScaleDn"), `${formatInteger(summary.zeroCount)} / ${formatInteger(summary.fullScaleCount)}`],
  ];
}

function roiRangeText(state: StatisticsPanelState): string {
  if (!state.imageWidth || !state.imageHeight) return t("statistics.noData");
  const roi = state.roi ?? { x: 0, y: 0, width: state.imageWidth, height: state.imageHeight };
  return `X[${roi.x}, ${roi.x + roi.width - 1}] Y[${roi.y}, ${roi.y + roi.height - 1}]`;
}

function chartTitle(key: StatisticsChartKey): string {
  if (key === "histogram") return t("statistics.histogram");
  return key === "row" ? t("statistics.rowProfile") : t("statistics.columnProfile");
}

export class StatisticsPanel {
  private readonly root: HTMLElement;
  private readonly options: StatisticsPanelOptions;
  private readonly charts: StatisticsCharts;
  private readonly resizeObserver: ResizeObserver;
  private state: StatisticsPanelState = {
    result: null,
    documentName: null,
    loading: false,
    error: null,
    roi: null,
    imageWidth: 0,
    imageHeight: 0,
    sideDockAvailable: true,
  };
  private viewState: StatisticsViewState = loadStatisticsViewState();
  private layout: StatisticsLayout;
  private active = true;
  private savedScrollTop = 0;
  private resizeKey: StatisticsChartKey | null = null;
  private resizePointerId: number | null = null;
  private resizeStartY = 0;
  private resizeStartHeight = 0;

  constructor(root: HTMLElement, options: StatisticsPanelOptions) {
    this.root = root;
    this.options = options;
    this.layout = options.layout ?? (options.detached ? "detached" : "bottom");
    this.root.classList.toggle("detached", options.detached);
    this.charts = new StatisticsCharts(root, {
      onRangeChange: (chart, axis, range) => {
        this.viewState.charts[chart][axis === "x" ? "xRange" : "yRange"] = range;
        saveStatisticsViewState(this.viewState);
      },
    });
    this.resizeObserver = new ResizeObserver(() => this.charts.resize());
    this.resizeObserver.observe(root);
    this.render();
  }

  setState(state: StatisticsPanelState): void {
    this.state = state;
    this.sanitizeViewState();
    this.render();
  }

  setLayout(layout: StatisticsLayout): void {
    if (layout === this.layout) return;
    this.layout = layout;
    this.viewState = loadStatisticsViewState();
    this.root.dataset.statisticsLayout = layout;
    this.render();
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    if (active) {
      this.viewState = loadStatisticsViewState();
      this.render();
    } else {
      this.charts.dispose();
    }
  }

  resetView(): void {
    resetStatisticsViewState(this.viewState, this.layout);
    saveStatisticsViewState(this.viewState);
    this.savedScrollTop = 0;
    this.render(false);
  }

  private availableGroups(): GroupStatistics[] {
    const result = this.state.result;
    if (!result) return [];
    if (result.snapshot.cfa === "MONO") {
      return [result.groups.find((group) => group.key === "Y") ?? result.groups[0]];
    }
    return result.groups;
  }

  private visibleGroups(key: StatisticsChartKey): string[] {
    const available = this.availableGroups().map((group) => group.key);
    return this.viewState.charts[key].visibleGroups?.filter((group) => available.includes(group)) ?? available;
  }

  private sanitizeViewState(): void {
    const result = this.state.result;
    if (!result) return;
    const available = this.availableGroups().map((group) => group.key);
    const roi = result.snapshot.roi;
    const domains: Record<StatisticsChartKey, StatisticsAxisRange> = {
      histogram: { start: 0, end: 2 ** result.snapshot.bitDepth - 1 },
      row: { start: roi.y, end: roi.y + roi.height - 1 },
      column: { start: roi.x, end: roi.x + roi.width - 1 },
    };
    for (const key of STATISTICS_CHART_KEYS) {
      const chart = this.viewState.charts[key];
      if (chart.visibleGroups) chart.visibleGroups = chart.visibleGroups.filter((group) => available.includes(group));
      chart.xRange = normalizeStatisticsRange(chart.xRange, domains[key].start, domains[key].end);
    }
  }

  private render(preserveScroll = true): void {
    const previousBody = this.root.querySelector<HTMLElement>(".statistics-body");
    if (preserveScroll && previousBody && previousBody.scrollHeight > previousBody.clientHeight) {
      this.savedScrollTop = previousBody.scrollTop;
    } else if (!preserveScroll) {
      this.savedScrollTop = 0;
    }
    this.charts.dispose();
    const result = this.state.result;
    const presentationAction = this.options.detached ? "dock" : "detach";
    const presentationLabel = this.options.detached ? t("statistics.dock") : t("statistics.detach");
    const switchToSide = this.layout === "bottom";
    this.root.dataset.statisticsLayout = this.layout;
    this.root.innerHTML = `
      <div class="statistics-toolbar">
        <div class="statistics-roi-readout">
          <span>ROI</span>
          <strong title="${escapeHtml(t("statistics.roiOrigin"))}">${roiRangeText(this.state)}</strong>
        </div>
        <div class="statistics-toolbar-actions">
          <button type="button" data-stat-action="reset">${t("statistics.resetView")}</button>
          ${this.options.detached ? "" : `<button type="button" data-stat-action="toggleDockPlacement" ${switchToSide && !this.state.sideDockAvailable ? "disabled" : ""} title="${switchToSide && !this.state.sideDockAvailable ? escapeHtml(t("statistics.sideUnavailable")) : ""}">${switchToSide ? t("statistics.dockSide") : t("statistics.dockBottom")}</button>`}
          <button type="button" data-stat-action="${presentationAction}">${presentationLabel}</button>
          ${this.options.detached ? "" : `<button type="button" data-stat-action="close">${t("common.close")}</button>`}
        </div>
      </div>
      <div class="statistics-body">
        ${this.renderBody(result)}
      </div>`;
    this.bindEvents();
    const body = this.root.querySelector<HTMLElement>(".statistics-body");
    if (body) {
      body.scrollTop = this.savedScrollTop;
      body.addEventListener("scroll", () => {
        if (body.scrollHeight > body.clientHeight) this.savedScrollTop = body.scrollTop;
      }, { passive: true });
    }
    if (this.active && result) {
      window.requestAnimationFrame(() => {
        if (this.state.result === result) this.charts.render(result, this.viewState);
      });
    }
  }

  private renderBody(result: AnalysisResult | null): string {
    if (!this.state.documentName) return `<div class="statistics-empty">${t("statistics.openFileHint")}</div>`;
    if (this.state.loading && !result) {
      return `<div class="statistics-empty busy"><i></i><strong>${t("statistics.calculating")}</strong><button type="button" data-stat-action="cancelAnalysis">${t("common.cancel")}</button></div>`;
    }
    if (this.state.error) return `<div class="statistics-empty error">${escapeHtml(this.state.error)}</div>`;
    if (!result) return `<div class="statistics-empty">${t("statistics.noData")}</div>`;

    const groups = this.availableGroups();
    const overall = result.snapshot.cfa === "MONO"
      ? result.groups.find((group) => group.key === "Y") ?? result.groups[0]
      : result.groups.find((group) => group.key === "all") ?? result.groups[0];
    const integrity = overall.summary.missingCount > 0
      ? `<p class="statistics-integrity warning">${t("statistics.integrityMissing", {
          expected: formatInteger(overall.summary.expectedCount),
          valid: formatInteger(overall.summary.validCount),
          missing: formatInteger(overall.summary.missingCount),
        })}</p>`
      : `<p class="statistics-integrity">${t("statistics.integrityComplete", { count: formatInteger(overall.summary.validCount) })}</p>`;
    const summary = `<div class="statistics-summary" aria-label="${escapeHtml(groupLabel(overall.key))}">${summaryRows(overall.summary).map(([label, value]) => `
      <div><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>`;
    const loading = this.state.loading
      ? `<div class="statistics-refreshing"><i></i>${t("statistics.calculating")}</div>`
      : "";
    return `
      ${loading}
      ${integrity}
      <div class="statistics-sections">
        ${this.chartSection("histogram", groups, summary)}
        ${this.chartSection("row", groups)}
        ${this.chartSection("column", groups)}
      </div>`;
  }

  private chartSection(key: StatisticsChartKey, groups: GroupStatistics[], footer = ""): string {
    const visible = new Set(this.visibleGroups(key));
    const height = this.viewState.heights[this.layout][key];
    const result = this.state.result!;
    const roi = result.snapshot.roi;
    const domain = key === "histogram"
      ? { start: 0, end: 2 ** result.snapshot.bitDepth - 1 }
      : key === "row"
        ? { start: roi.y, end: roi.y + roi.height - 1 }
        : { start: roi.x, end: roi.x + roi.width - 1 };
    const range = normalizeStatisticsRange(this.viewState.charts[key].xRange, domain.start, domain.end) ?? domain;
    return `<section class="statistics-section" data-stat-section="${key}" style="--statistics-chart-height:${Math.round(height)}px">
      <header>
        <div class="statistics-section-heading"><h2>${chartTitle(key)}</h2><p>${t("statistics.chartInteraction")}</p></div>
        <div class="statistics-curve-switches" aria-label="${t("statistics.curves")}">${groups.map((group) => `
          <button type="button" data-stat-group-chart="${key}" data-stat-group="${group.key}" aria-pressed="${visible.has(group.key)}" class="${visible.has(group.key) ? "active" : ""}">${groupLabel(group.key)}</button>`).join("")}</div>
        <button type="button" class="statistics-y-reset" data-stat-y-reset="${key}" title="${t("statistics.resetYAxis")}">Y↕</button>
      </header>
      <div class="statistics-chart" data-stat-chart="${key}" role="img" aria-label="${chartTitle(key)}"></div>
      <div class="statistics-axis-range" aria-label="${t("statistics.visibleRange")}">
        <input type="number" step="1" data-stat-range-chart="${key}" data-stat-range-edge="start" value="${Math.round(range.start)}" aria-label="${t("statistics.rangeStart")}"/>
        <span aria-hidden="true"></span>
        <input type="number" step="1" data-stat-range-chart="${key}" data-stat-range-edge="end" value="${Math.round(range.end)}" aria-label="${t("statistics.rangeEnd")}"/>
      </div>
      ${footer}
    </section>
    <div class="statistics-section-resizer" data-stat-resize="${key}" title="${t("statistics.resizeChart")}" aria-hidden="true"></div>`;
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
    this.root.querySelectorAll<HTMLButtonElement>("[data-stat-group-chart]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.statGroupChart as StatisticsChartKey;
        const group = button.dataset.statGroup!;
        const current = new Set(this.visibleGroups(key));
        if (current.has(group)) current.delete(group); else current.add(group);
        this.viewState.charts[key].visibleGroups = [...current];
        saveStatisticsViewState(this.viewState);
        this.render();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-stat-y-reset]").forEach((button) => {
      button.addEventListener("click", () => this.charts.resetYRange(button.dataset.statYReset as StatisticsChartKey));
    });
    this.root.querySelectorAll<HTMLInputElement>("[data-stat-range-chart]").forEach((input) => {
      const apply = () => this.applyManualRange(input);
      input.addEventListener("change", apply);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          apply();
          input.blur();
        }
      });
    });
    this.root.querySelectorAll<HTMLElement>("[data-stat-resize]").forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => this.beginChartResize(event, handle));
      handle.addEventListener("pointermove", (event) => this.updateChartResize(event, handle));
      handle.addEventListener("pointerup", (event) => this.endChartResize(event, handle));
      handle.addEventListener("pointercancel", (event) => this.endChartResize(event, handle));
      handle.addEventListener("dblclick", () => {
        const key = handle.dataset.statResize as StatisticsChartKey;
        this.viewState.heights[this.layout][key] = DEFAULT_STATISTICS_CHART_HEIGHT[this.layout];
        saveStatisticsViewState(this.viewState);
        this.render();
      });
    });
  }

  private chartDomain(key: StatisticsChartKey): StatisticsAxisRange | null {
    const result = this.state.result;
    if (!result) return null;
    if (key === "histogram") return { start: 0, end: 2 ** result.snapshot.bitDepth - 1 };
    const roi = result.snapshot.roi;
    return key === "row"
      ? { start: roi.y, end: roi.y + roi.height - 1 }
      : { start: roi.x, end: roi.x + roi.width - 1 };
  }

  private applyManualRange(input: HTMLInputElement): void {
    const key = input.dataset.statRangeChart as StatisticsChartKey;
    const edge = input.dataset.statRangeEdge as "start" | "end";
    const domain = this.chartDomain(key);
    const value = Number(input.value);
    if (!domain || !Number.isFinite(value)) {
      this.render();
      return;
    }
    const current = normalizeStatisticsRange(this.viewState.charts[key].xRange, domain.start, domain.end) ?? domain;
    const range = normalizeManualStatisticsRange(edge, value, current, domain.start, domain.end);
    this.viewState.charts[key].xRange = normalizeStatisticsRange(range, domain.start, domain.end);
    saveStatisticsViewState(this.viewState);
    this.charts.applyXRange(key, this.viewState.charts[key].xRange);
  }

  private beginChartResize(event: PointerEvent, handle: HTMLElement): void {
    if (event.button !== 0) return;
    const key = handle.dataset.statResize as StatisticsChartKey;
    event.preventDefault();
    this.resizeKey = key;
    this.resizePointerId = event.pointerId;
    this.resizeStartY = event.clientY;
    this.resizeStartHeight = this.viewState.heights[this.layout][key];
    handle.setPointerCapture(event.pointerId);
    this.root.classList.add("resizing-statistics-chart");
  }

  private updateChartResize(event: PointerEvent, _handle: HTMLElement): void {
    if (this.resizePointerId !== event.pointerId || !this.resizeKey) return;
    const height = Math.max(220, Math.min(900, this.resizeStartHeight + event.clientY - this.resizeStartY));
    this.viewState.heights[this.layout][this.resizeKey] = height;
    const section = this.root.querySelector<HTMLElement>(`[data-stat-section="${this.resizeKey}"]`);
    section?.style.setProperty("--statistics-chart-height", `${Math.round(height)}px`);
    this.charts.resize();
  }

  private endChartResize(event: PointerEvent, handle: HTMLElement): void {
    if (this.resizePointerId !== event.pointerId) return;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    this.resizeKey = null;
    this.resizePointerId = null;
    this.root.classList.remove("resizing-statistics-chart");
    saveStatisticsViewState(this.viewState);
  }
}
