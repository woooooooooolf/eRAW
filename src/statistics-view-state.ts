export type StatisticsChartKey = "histogram" | "row" | "column";
export type StatisticsLayout = "bottom" | "side" | "detached";

export interface StatisticsAxisRange {
  start: number;
  end: number;
}

export interface StatisticsChartViewState {
  visibleGroups: string[] | null;
  xRange: StatisticsAxisRange | null;
  yRange: StatisticsAxisRange | null;
}

export interface StatisticsViewState {
  charts: Record<StatisticsChartKey, StatisticsChartViewState>;
  heights: Record<StatisticsLayout, Record<StatisticsChartKey, number>>;
}

const STORAGE_KEY = "eraw.statisticsView.v1";
export const STATISTICS_CHART_KEYS: StatisticsChartKey[] = ["histogram", "row", "column"];
export const DEFAULT_STATISTICS_CHART_HEIGHT: Record<StatisticsLayout, number> = {
  bottom: 280,
  side: 310,
  detached: 330,
};

function defaultChartState(): StatisticsChartViewState {
  return { visibleGroups: null, xRange: null, yRange: null };
}

export function defaultStatisticsViewState(): StatisticsViewState {
  const heights = (layout: StatisticsLayout) => Object.fromEntries(
    STATISTICS_CHART_KEYS.map((key) => [key, DEFAULT_STATISTICS_CHART_HEIGHT[layout]]),
  ) as Record<StatisticsChartKey, number>;
  return {
    charts: {
      histogram: defaultChartState(),
      row: defaultChartState(),
      column: defaultChartState(),
    },
    heights: {
      bottom: heights("bottom"),
      side: heights("side"),
      detached: heights("detached"),
    },
  };
}

function finiteRange(value: unknown): StatisticsAxisRange | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StatisticsAxisRange>;
  if (!Number.isFinite(candidate.start) || !Number.isFinite(candidate.end)) return null;
  return { start: Number(candidate.start), end: Number(candidate.end) };
}

export function normalizeStatisticsRange(
  range: StatisticsAxisRange | null,
  domainStart: number,
  domainEnd: number,
): StatisticsAxisRange | null {
  if (!range || !Number.isFinite(domainStart) || !Number.isFinite(domainEnd) || domainEnd < domainStart) {
    return null;
  }
  const start = Math.max(domainStart, Math.min(domainEnd, range.start));
  const end = Math.max(domainStart, Math.min(domainEnd, range.end));
  if (end <= start) return null;
  if (start <= domainStart && end >= domainEnd) return null;
  return { start, end };
}

export function normalizeManualStatisticsRange(
  edited: "start" | "end",
  value: number,
  current: StatisticsAxisRange,
  domainStart: number,
  domainEnd: number,
): StatisticsAxisRange {
  if (domainEnd <= domainStart) return { start: domainStart, end: domainEnd };
  const step = 1;
  if (edited === "start") {
    let start = Math.max(domainStart, Math.min(domainEnd, Math.trunc(value)));
    let end = current.end;
    if (start >= end) end = domainEnd;
    if (start >= end) start = Math.max(domainStart, domainEnd - step);
    return { start, end };
  }
  let end = Math.max(domainStart, Math.min(domainEnd, Math.trunc(value)));
  let start = current.start;
  if (end <= start) start = domainStart;
  if (end <= start) end = Math.min(domainEnd, domainStart + step);
  return { start, end };
}

export function loadStatisticsViewState(): StatisticsViewState {
  const fallback = defaultStatisticsViewState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StatisticsViewState>;
    for (const key of STATISTICS_CHART_KEYS) {
      const chart = parsed.charts?.[key];
      fallback.charts[key] = {
        visibleGroups: Array.isArray(chart?.visibleGroups)
          ? chart.visibleGroups.filter((value): value is string => typeof value === "string")
          : null,
        xRange: finiteRange(chart?.xRange),
        yRange: finiteRange(chart?.yRange),
      };
      for (const layout of ["bottom", "side", "detached"] as const) {
        const height = parsed.heights?.[layout]?.[key];
        if (Number.isFinite(height)) fallback.heights[layout][key] = Math.max(220, Math.min(900, Number(height)));
      }
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function saveStatisticsViewState(state: StatisticsViewState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetStatisticsViewState(state: StatisticsViewState, layout: StatisticsLayout): void {
  for (const key of STATISTICS_CHART_KEYS) {
    state.charts[key] = defaultChartState();
    state.heights[layout][key] = DEFAULT_STATISTICS_CHART_HEIGHT[layout];
  }
}
