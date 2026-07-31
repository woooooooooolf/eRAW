import type { ImageRect } from "./viewport-transform";

export const ROI_DRAG_THRESHOLD_PX = 4;

export interface RoiCoordinateValues {
  xStart: string | number;
  xEnd: string | number;
  yStart: string | number;
  yEnd: string | number;
}

export type RoiCoordinateField = keyof RoiCoordinateValues;
export type RoiCoordinateErrorReason = "integer" | "xOrder" | "yOrder" | "bounds";

export type RoiCoordinateValidation =
  | { ok: true; rect: ImageRect }
  | { ok: false; field: RoiCoordinateField; reason: RoiCoordinateErrorReason };

export function hasExceededRoiDragThreshold(
  start: { x: number; y: number },
  current: { x: number; y: number },
  threshold = ROI_DRAG_THRESHOLD_PX,
): boolean {
  const deltaX = current.x - start.x;
  const deltaY = current.y - start.y;
  return deltaX * deltaX + deltaY * deltaY >= threshold * threshold;
}

function parseInteger(value: string | number): number | null {
  if (typeof value === "string" && !/^-?\d+$/.test(value.trim())) return null;
  const normalized = typeof value === "number" ? value : Number(value.trim());
  return Number.isInteger(normalized) ? normalized : null;
}

export function validateRoiCoordinates(
  values: RoiCoordinateValues,
  imageWidth: number,
  imageHeight: number,
): RoiCoordinateValidation {
  const fields = Object.keys(values) as RoiCoordinateField[];
  const coordinates = {} as Record<RoiCoordinateField, number>;
  for (const field of fields) {
    const value = parseInteger(values[field]);
    if (value === null) return { ok: false, field, reason: "integer" };
    coordinates[field] = value;
  }

  if (coordinates.xStart > coordinates.xEnd) {
    return { ok: false, field: "xEnd", reason: "xOrder" };
  }
  if (coordinates.yStart > coordinates.yEnd) {
    return { ok: false, field: "yEnd", reason: "yOrder" };
  }

  const bounds: Array<[RoiCoordinateField, number]> = [
    ["xStart", imageWidth],
    ["xEnd", imageWidth],
    ["yStart", imageHeight],
    ["yEnd", imageHeight],
  ];
  for (const [field, upperBound] of bounds) {
    const value = coordinates[field];
    if (value < 0 || value >= upperBound) {
      return { ok: false, field, reason: "bounds" };
    }
  }

  return {
    ok: true,
    rect: {
      x: coordinates.xStart,
      y: coordinates.yStart,
      width: coordinates.xEnd - coordinates.xStart + 1,
      height: coordinates.yEnd - coordinates.yStart + 1,
    },
  };
}
