import type { AnalysisResult, ProfilePoint } from "./types";
import type { ImagePoint } from "./viewport-transform";

export const MIN_COORDINATE_HIGHLIGHT_ZOOM = 12;

export type StatisticsProfileAxis = "row" | "column";

export interface StatisticsProfileHover {
  axis: StatisticsProfileAxis;
  coordinate: number;
}

export interface ViewportCoordinateHighlight {
  x: number | null;
  y: number | null;
}

export interface StatisticsLinkedPixel {
  generation: number;
  analysisRevision: number;
  frame: number;
  point: ImagePoint;
}

export interface StatisticsWindowHoverMessage {
  hover: StatisticsProfileHover | null;
  source: "detached";
}

export interface CoordinateLinkInteractionState {
  pointerPixel: ImagePoint | null;
  locatedPixel: ImagePoint | null;
  profileHover: StatisticsProfileHover | null;
}

export type CoordinateLinkInteraction =
  | { type: "pointer"; point: ImagePoint | null }
  | { type: "profile"; hover: StatisticsProfileHover | null }
  | { type: "locate"; point: ImagePoint }
  | { type: "reset" };

export function emptyCoordinateLinkState(): CoordinateLinkInteractionState {
  return { pointerPixel: null, locatedPixel: null, profileHover: null };
}

export function updateCoordinateLinkState(
  state: CoordinateLinkInteractionState,
  interaction: CoordinateLinkInteraction,
): CoordinateLinkInteractionState {
  if (interaction.type === "reset") return emptyCoordinateLinkState();
  if (interaction.type === "locate") {
    return {
      pointerPixel: null,
      locatedPixel: { x: interaction.point.x, y: interaction.point.y },
      profileHover: null,
    };
  }
  if (interaction.type === "pointer") {
    return {
      pointerPixel: interaction.point
        ? { x: interaction.point.x, y: interaction.point.y }
        : null,
      locatedPixel: null,
      profileHover: interaction.point ? null : state.profileHover,
    };
  }
  return interaction.hover
    ? {
      pointerPixel: null,
      locatedPixel: null,
      profileHover: { ...interaction.hover },
    }
    : { ...state, profileHover: null };
}

export function coordinateHighlightEnabled(zoom: number): boolean {
  return Number.isFinite(zoom) && zoom >= MIN_COORDINATE_HIGHLIGHT_ZOOM;
}

export function profileHoverAtCoordinate(
  axis: StatisticsProfileAxis,
  rawCoordinate: unknown,
  domainStart: number,
  domainEnd: number,
): StatisticsProfileHover | null {
  const coordinate = Math.round(Number(rawCoordinate));
  if (
    !Number.isFinite(coordinate)
    || coordinate < domainStart
    || coordinate > domainEnd
  ) return null;
  return { axis, coordinate };
}

export function linkedPixelForResult(
  point: ImagePoint | null,
  result: AnalysisResult | null,
): StatisticsLinkedPixel | null {
  if (!point || !result) return null;
  const { roi } = result.snapshot;
  if (
    point.x < roi.x
    || point.y < roi.y
    || point.x >= roi.x + roi.width
    || point.y >= roi.y + roi.height
  ) return null;
  return {
    generation: result.snapshot.generation,
    analysisRevision: result.snapshot.analysisRevision,
    frame: result.snapshot.frame,
    point: { x: point.x, y: point.y },
  };
}

export function resolveLinkedPixel(
  link: StatisticsLinkedPixel | null,
  result: AnalysisResult | null,
): ImagePoint | null {
  if (!link || !result) return null;
  if (
    link.generation !== result.snapshot.generation
    || link.analysisRevision !== result.snapshot.analysisRevision
    || link.frame !== result.snapshot.frame
  ) return null;
  return linkedPixelForResult(link.point, result)?.point ?? null;
}

export function profilePointAtCoordinate(
  points: readonly ProfilePoint[],
  coordinate: number,
): ProfilePoint | null {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (points[middle].coordinate < coordinate) low = middle + 1;
    else high = middle;
  }
  return points[low]?.coordinate === coordinate ? points[low] : null;
}
