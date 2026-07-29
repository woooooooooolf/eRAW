export type MissingPixelPattern = "darkCheckerboard" | "lightCheckerboard" | "solid";

export interface MissingPixelAppearance {
  pattern: MissingPixelPattern;
  color: string;
}

export const DEFAULT_MISSING_PIXEL_APPEARANCE: MissingPixelAppearance = {
  pattern: "darkCheckerboard",
  color: "#808080",
};

export function isMissingPixelPattern(value: unknown): value is MissingPixelPattern {
  return value === "darkCheckerboard" || value === "lightCheckerboard" || value === "solid";
}

export function normalizeMissingPixelColor(
  value: unknown,
  fallback = DEFAULT_MISSING_PIXEL_APPEARANCE.color,
): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback;
}

export function missingPixelPatternIndex(pattern: MissingPixelPattern): number {
  return pattern === "darkCheckerboard" ? 0 : pattern === "lightCheckerboard" ? 1 : 2;
}

export function hexColorToUnitRgb(color: string): [number, number, number] {
  const normalized = normalizeMissingPixelColor(color);
  return [
    Number.parseInt(normalized.slice(1, 3), 16) / 255,
    Number.parseInt(normalized.slice(3, 5), 16) / 255,
    Number.parseInt(normalized.slice(5, 7), 16) / 255,
  ];
}
