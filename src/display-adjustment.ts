import type {
  DisplayWindow,
  RawDisplayRangeResult,
} from "./types";

export const MIN_DISPLAY_EXPOSURE = -8;
export const MAX_DISPLAY_EXPOSURE = 8;
export const DISPLAY_EXPOSURE_STEP = 0.1;

export type DisplayWindowField = "blackPoint" | "whitePoint";

export function displayFullScale(bitDepth: number): number {
  const depth = Math.max(1, Math.min(16, Math.trunc(bitDepth) || 1));
  return depth === 16 ? 0xffff : 2 ** depth - 1;
}

export function defaultDisplayWindow(bitDepth: number): DisplayWindow {
  return { blackPoint: 0, whitePoint: displayFullScale(bitDepth) };
}

export function normalizeDisplayExposure(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const clamped = Math.max(MIN_DISPLAY_EXPOSURE, Math.min(MAX_DISPLAY_EXPOSURE, numeric));
  const rounded = Math.round(clamped / DISPLAY_EXPOSURE_STEP) * DISPLAY_EXPOSURE_STEP;
  return Object.is(rounded, -0) ? 0 : Number(rounded.toFixed(1));
}

export function normalizeDisplayWindow(
  window: DisplayWindow,
  bitDepth: number,
): DisplayWindow {
  const fallback = defaultDisplayWindow(bitDepth);
  const blackPoint = Math.max(
    0,
    Math.min(fallback.whitePoint, Math.trunc(Number(window.blackPoint))),
  );
  const whitePoint = Math.max(
    0,
    Math.min(fallback.whitePoint, Math.trunc(Number(window.whitePoint))),
  );
  if (!Number.isFinite(blackPoint) || !Number.isFinite(whitePoint) || blackPoint >= whitePoint) {
    return fallback;
  }
  return { blackPoint, whitePoint };
}

export function updateDisplayWindow(
  window: DisplayWindow,
  field: DisplayWindowField,
  value: unknown,
  bitDepth: number,
): DisplayWindow {
  const current = normalizeDisplayWindow(window, bitDepth);
  const fullScale = displayFullScale(bitDepth);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return current;
  const integer = Math.trunc(numeric);
  if (field === "blackPoint") {
    return {
      blackPoint: Math.max(0, Math.min(current.whitePoint - 1, integer)),
      whitePoint: current.whitePoint,
    };
  }
  return {
    blackPoint: current.blackPoint,
    whitePoint: Math.max(current.blackPoint + 1, Math.min(fullScale, integer)),
  };
}

export function automaticDisplayWindow(
  result: Pick<RawDisplayRangeResult, "p1" | "p99" | "minimum" | "maximum">,
  bitDepth: number,
): DisplayWindow | null {
  const candidates: Array<readonly [number | null, number | null]> = [
    [result.p1, result.p99],
    [result.minimum, result.maximum],
  ];
  for (const [blackPoint, whitePoint] of candidates) {
    if (blackPoint === null || whitePoint === null || blackPoint >= whitePoint) continue;
    return normalizeDisplayWindow({ blackPoint, whitePoint }, bitDepth);
  }
  return null;
}

export function displayValueToUnit(
  value: number,
  window: DisplayWindow,
  exposure: number,
): number {
  const span = Math.max(1, window.whitePoint - window.blackPoint);
  const normalized = Math.max(0, Math.min(1, (value - window.blackPoint) / span));
  return Math.max(0, Math.min(1, normalized * 2 ** normalizeDisplayExposure(exposure)));
}
