import type { DemosaicPixelValueMode, DisplayMode } from "./types";

export type PixelValueDisplay = "raw" | "rgb" | "red" | "green" | "blue";

export interface InspectedPixelValues {
  raw: number;
  red: number;
  green: number;
  blue: number;
  rawValid: boolean;
  rgbValid: boolean;
}

export function resolvePixelValueDisplay(
  displayMode: DisplayMode,
  demosaicValues: DemosaicPixelValueMode,
): PixelValueDisplay {
  if (displayMode === "demosaic" && demosaicValues === "rgb") return "rgb";
  if (displayMode === "red" || displayMode === "green" || displayMode === "blue") {
    return displayMode;
  }
  return "raw";
}

export function widestPixelValueText(display: PixelValueDisplay, maxValue: number): string {
  if (display === "raw") return String(maxValue);
  if (display === "rgb") return `G ${maxValue}`;
  return `${display[0].toUpperCase()} ${maxValue}`;
}

export function pixelValueLines(
  display: PixelValueDisplay,
  values: InspectedPixelValues,
): string[] {
  if (display === "rgb") {
    return values.rgbValid
      ? [`R ${values.red}`, `G ${values.green}`, `B ${values.blue}`]
      : ["R —", "G —", "B —"];
  }
  if (display === "raw") return [values.rawValid ? String(values.raw) : "—"];
  const label = display[0].toUpperCase();
  return [values.rgbValid ? `${label} ${values[display]}` : `${label} —`];
}
