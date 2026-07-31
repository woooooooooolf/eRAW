import { t } from "./i18n";
import { StatisticsCharts } from "./statistics-chart";
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
}

interface StatisticsPanelOptions {
  detached: boolean;
  onAction(action: StatisticsPanelAction): void;
}

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
  const roi = state.roi ?? {
    x: 0,
    y: 0,
    width: state.imageWidth,
    height: state.imageHeight,
  };
  return `X[${roi.x}, ${roi.x + roi.width - 1}] Y[${roi.y}, ${roi.y + roi.height - 1}]`;
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
  };
  private selectedGroup = "all";
  private active = true;
  private savedScrollTop = 0;

  constructor(root: HTMLElement, options: StatisticsPanelOptions) {
    this.root = root;
    this.options = options;
    this.root.classList.toggle("detached", options.detached);
    this.charts = new StatisticsCharts(root);
    this.resizeObserver = new ResizeObserver(() => this.charts.resize());
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

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    if (active) this.render();
    else this.charts.dispose();
  }

  resetView(): void {
    this.selectedGroup = "all";
    this.savedScrollTop = 0;
    this.render(false);
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
    const selected = result?.groups.find((group) => group.key === this.selectedGroup) ?? result?.groups[0];
    const presentationAction = this.options.detached ? "dock" : "detach";
    const presentationLabel = this.options.detached ? t("statistics.dock") : t("statistics.detach");
    this.root.innerHTML = `
      <div class="statistics-toolbar">
        <div class="statistics-roi-readout">
          <span>ROI</span>
          <strong title="${escapeHtml(t("statistics.roiOrigin"))}">${roiRangeText(this.state)}</strong>
        </div>
        <div class="statistics-toolbar-actions">
          <button type="button" data-stat-action="reset">${t("statistics.resetView")}</button>
          <button type="button" data-stat-action="${presentationAction}">${presentationLabel}</button>
          ${this.options.detached ? "" : `<button type="button" data-stat-action="close">${t("common.close")}</button>`}
        </div>
      </div>
      <div class="statistics-body">
        ${this.renderBody(selected)}
      </div>`;
    this.bindEvents();
    const body = this.root.querySelector<HTMLElement>(".statistics-body");
    if (body) {
      body.scrollTop = this.savedScrollTop;
      body.addEventListener("scroll", () => {
        if (body.scrollHeight > body.clientHeight) this.savedScrollTop = body.scrollTop;
      }, { passive: true });
    }
    if (this.active && result && selected) {
      window.requestAnimationFrame(() => {
        if (this.state.result === result) this.charts.render(result, selected.key);
      });
    }
  }

  private renderBody(selected: GroupStatistics | undefined): string {
    if (!this.state.documentName) {
      return `<div class="statistics-empty">${t("statistics.openFileHint")}</div>`;
    }
    if (this.state.loading && !this.state.result) {
      return `<div class="statistics-empty busy"><i></i><strong>${t("statistics.calculating")}</strong><button type="button" data-stat-action="cancelAnalysis">${t("common.cancel")}</button></div>`;
    }
    if (this.state.error) {
      return `<div class="statistics-empty error">${escapeHtml(this.state.error)}</div>`;
    }
    if (!selected || !this.state.result) {
      return `<div class="statistics-empty">${t("statistics.noData")}</div>`;
    }

    const overall = this.state.result.groups.find((group) => group.key === "all") ?? this.state.result.groups[0];
    const integrity = overall.summary.missingCount > 0
      ? `<p class="statistics-integrity warning">${t("statistics.integrityMissing", {
          expected: formatInteger(overall.summary.expectedCount),
          valid: formatInteger(overall.summary.validCount),
          missing: formatInteger(overall.summary.missingCount),
        })}</p>`
      : `<p class="statistics-integrity">${t("statistics.integrityComplete", {
          count: formatInteger(overall.summary.validCount),
        })}</p>`;
    const channels = `<div class="statistics-channel-row">
      <span>${t("statistics.samplingSites")}</span>
      <div class="statistics-channels">${this.state.result.groups.map((group) => `
        <button type="button" data-stat-group="${group.key}" class="${group.key === selected.key ? "active" : ""}">
          ${group.key === "all" ? t("statistics.allCfa") : group.key}
        </button>`).join("")}</div>
    </div>`;
    const summary = `<div class="statistics-summary">${summaryRows(selected.summary).map(([label, value]) => `
      <div><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>`;
    const loading = this.state.loading
      ? `<div class="statistics-refreshing"><i></i>${t("statistics.calculating")}</div>`
      : "";
    return `
      ${loading}
      ${integrity}
      ${channels}
      <div class="statistics-sections">
        <section class="statistics-section">
          <header><div><h2>${t("statistics.histogram")}</h2><p>${t("statistics.chartInteraction")}</p></div></header>
          <div class="statistics-chart" data-stat-chart="histogram" role="img" aria-label="${t("statistics.histogram")}"></div>
          ${summary}
        </section>
        <section class="statistics-section">
          <header><div><h2>${t("statistics.rowProfile")}</h2><p>${t("statistics.chartInteraction")}</p></div></header>
          <div class="statistics-chart" data-stat-chart="row" role="img" aria-label="${t("statistics.rowProfile")}"></div>
        </section>
        <section class="statistics-section">
          <header><div><h2>${t("statistics.columnProfile")}</h2><p>${t("statistics.chartInteraction")}</p></div></header>
          <div class="statistics-chart" data-stat-chart="column" role="img" aria-label="${t("statistics.columnProfile")}"></div>
        </section>
      </div>`;
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
    this.root.querySelectorAll<HTMLButtonElement>("[data-stat-group]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedGroup = button.dataset.statGroup ?? "all";
        this.render();
      });
    });
  }
}
