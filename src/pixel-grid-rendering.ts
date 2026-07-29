export const DEFAULT_PIXEL_GRID_COLOR = "#8ecde4";

export function normalizePixelGridColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : DEFAULT_PIXEL_GRID_COLOR;
}

export function pixelGridStrokeStyle(value: unknown): string {
  return `${normalizePixelGridColor(value)}38`;
}
