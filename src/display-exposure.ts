import type { DisplayMode } from "./types";
import {
  DISPLAY_EXPOSURE_STEP,
  MAX_DISPLAY_EXPOSURE,
  MIN_DISPLAY_EXPOSURE,
  normalizeDisplayExposure,
} from "./raw-display-adjustment";

export const MIN_DEMOSAIC_DISPLAY_EXPOSURE = MIN_DISPLAY_EXPOSURE;
export const MAX_DEMOSAIC_DISPLAY_EXPOSURE = MAX_DISPLAY_EXPOSURE;
export const DEMOSAIC_DISPLAY_EXPOSURE_STEP = DISPLAY_EXPOSURE_STEP;

export function normalizeDemosaicDisplayExposure(value: unknown): number {
  return normalizeDisplayExposure(value);
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
