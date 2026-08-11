import type { DisplayMode } from "./types";

export const MIN_DEMOSAIC_DISPLAY_EXPOSURE = -8;
export const MAX_DEMOSAIC_DISPLAY_EXPOSURE = 8;
export const DEMOSAIC_DISPLAY_EXPOSURE_STEP = 0.1;

export function normalizeDemosaicDisplayExposure(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const clamped = Math.max(
    MIN_DEMOSAIC_DISPLAY_EXPOSURE,
    Math.min(MAX_DEMOSAIC_DISPLAY_EXPOSURE, numeric),
  );
  const rounded = Math.round(clamped / DEMOSAIC_DISPLAY_EXPOSURE_STEP)
    * DEMOSAIC_DISPLAY_EXPOSURE_STEP;
  return Object.is(rounded, -0) ? 0 : Number(rounded.toFixed(1));
}

export function effectiveDemosaicDisplayExposure(
  mode: DisplayMode,
  exposure: number,
): number {
  return mode === "demosaic" ? normalizeDemosaicDisplayExposure(exposure) : 0;
}

export function applyDemosaicDisplayExposure(
  value: number,
  mode: DisplayMode,
  exposure: number,
): number {
  const gain = 2 ** effectiveDemosaicDisplayExposure(mode, exposure);
  return Math.max(0, Math.min(255, Math.round(value * gain)));
}
