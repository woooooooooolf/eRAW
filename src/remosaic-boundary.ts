import type { DisplayMode, ProcessingSettings, RawDescriptor } from "./types";
import type { ImageRect } from "./viewport-transform";

export type ReorderEdge = "left" | "right" | "top" | "bottom";

/** Coordinate support only: readable source bytes are a separate concern. */
export function unsupportedReorderEdges(
  descriptor: RawDescriptor,
  processing: ProcessingSettings,
  mode: DisplayMode,
  rect: ImageRect = { x: 0, y: 0, width: descriptor.width, height: descriptor.height },
): ReorderEdge[] {
  if (!descriptor.cfa.startsWith("Q") || processing.remosaic.sameColorReconstruction
    || mode === "raw" || mode === "bayer" || rect.width <= 0 || rect.height <= 0) return [];
  const halo = mode === "remosaic" ? 0 : 1;
  const x0 = Math.max(0, rect.x - halo);
  const y0 = Math.max(0, rect.y - halo);
  const x1 = Math.min(descriptor.width, rect.x + rect.width + halo);
  const y1 = Math.min(descriptor.height, rect.y + rect.height + halo);
  const px = descriptor.cfaPhaseX % 4;
  const py = descriptor.cfaPhaseY % 4;
  const edges: ReorderEdge[] = [];
  if (x0 === 0 && px === 2) edges.push("left");
  if (x1 === descriptor.width && (descriptor.width + px) % 4 === 2) edges.push("right");
  if (y0 === 0 && py === 2) edges.push("top");
  if (y1 === descriptor.height && (descriptor.height + py) % 4 === 2) edges.push("bottom");
  return edges;
}
