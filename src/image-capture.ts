import { renderTile } from "./api";
import {
  channelTint,
  type ChannelRenderingMode,
} from "./channel-rendering";
import { effectiveDemosaicDisplayExposure } from "./display-exposure";
import {
  normalizeMissingPixelColor,
  type MissingPixelAppearance,
} from "./missing-pixel-rendering";
import type {
  DisplayMode,
  ProcessingSettings,
  TileRequest,
} from "./types";

export const CAPTURE_TILE_SIZE = 256;
export const PREVIEW_MAX_EDGE = 4096;
const PREVIEW_CONCURRENCY = 4;

const DARK_CHECKER: readonly [readonly [number, number, number], readonly [number, number, number]] = [
  [73, 81, 92],
  [41, 47, 55],
];
const LIGHT_CHECKER: readonly [readonly [number, number, number], readonly [number, number, number]] = [
  [232, 236, 241],
  [198, 204, 212],
];

export interface PreviewCaptureSnapshot {
  generation: number;
  renderRevision: number;
  frame: number;
  imageWidth: number;
  imageHeight: number;
  mode: DisplayMode;
  processing: ProcessingSettings;
  displayMin: number;
  displayMax: number;
  channelRendering: ChannelRenderingMode;
  demosaicDisplayExposure: number;
  missingPixelAppearance: MissingPixelAppearance;
}

export interface PreviewDimensions {
  level: number;
  scale: number;
  width: number;
  height: number;
}

type TileRenderer = (request: TileRequest) => Promise<Uint8Array>;

export function previewDimensions(
  imageWidth: number,
  imageHeight: number,
  maxEdge = PREVIEW_MAX_EDGE,
): PreviewDimensions {
  const safeWidth = Math.max(1, Math.trunc(imageWidth));
  const safeHeight = Math.max(1, Math.trunc(imageHeight));
  const safeMaxEdge = Math.max(1, Math.trunc(maxEdge));
  let level = 0;
  while (
    Math.ceil(safeWidth / 2 ** level) > safeMaxEdge
    || Math.ceil(safeHeight / 2 ** level) > safeMaxEdge
  ) {
    level += 1;
  }
  const scale = 2 ** level;
  return {
    level,
    scale,
    width: Math.ceil(safeWidth / scale),
    height: Math.ceil(safeHeight / scale),
  };
}

function solidColor(color: string): [number, number, number] {
  const normalized = normalizeMissingPixelColor(color);
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

export function applyPreviewPresentation(
  bytes: Uint8Array,
  tileX: number,
  tileY: number,
  mode: DisplayMode,
  rendering: ChannelRenderingMode,
  missing: MissingPixelAppearance,
  demosaicDisplayExposure = 0,
  tileSize = CAPTURE_TILE_SIZE,
): Uint8Array {
  const tint = channelTint(mode, rendering);
  const exposureGain = 2 ** effectiveDemosaicDisplayExposure(mode, demosaicDisplayExposure);
  const solid = solidColor(missing.color);
  for (let offset = 0; offset + 3 < bytes.length; offset += 4) {
    const alpha = bytes[offset + 3];
    if (alpha === 254) {
      const pixel = offset / 4;
      const x = tileX * tileSize + pixel % tileSize;
      const y = tileY * tileSize + Math.floor(pixel / tileSize);
      const lightSquare = (Math.floor(x / 12) + Math.floor(y / 12)) % 2 === 0;
      const replacement = missing.pattern === "solid"
        ? solid
        : (missing.pattern === "lightCheckerboard" ? LIGHT_CHECKER : DARK_CHECKER)[lightSquare ? 0 : 1];
      bytes[offset] = replacement[0];
      bytes[offset + 1] = replacement[1];
      bytes[offset + 2] = replacement[2];
      bytes[offset + 3] = 255;
      continue;
    }
    if (
      alpha !== 0
      && bytes[offset] === bytes[offset + 1]
      && bytes[offset + 1] === bytes[offset + 2]
    ) {
      bytes[offset] = Math.round(bytes[offset] * tint[0]);
      bytes[offset + 1] = Math.round(bytes[offset + 1] * tint[1]);
      bytes[offset + 2] = Math.round(bytes[offset + 2] * tint[2]);
    }
    if (alpha !== 0 && mode === "demosaic" && demosaicDisplayExposure !== 0) {
      bytes[offset] = Math.min(255, Math.round(bytes[offset] * exposureGain));
      bytes[offset + 1] = Math.min(255, Math.round(bytes[offset + 1] * exposureGain));
      bytes[offset + 2] = Math.min(255, Math.round(bytes[offset + 2] * exposureGain));
    }
  }
  return bytes;
}

export async function renderPreviewCanvas(
  snapshot: PreviewCaptureSnapshot,
  renderer: TileRenderer = renderTile,
): Promise<HTMLCanvasElement> {
  const dimensions = previewDimensions(snapshot.imageWidth, snapshot.imageHeight);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("preview_canvas_unavailable");
  const columns = Math.ceil(dimensions.width / CAPTURE_TILE_SIZE);
  const rows = Math.ceil(dimensions.height / CAPTURE_TILE_SIZE);
  const coordinates: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) coordinates.push({ x, y });
  }
  let next = 0;
  const worker = async () => {
    while (next < coordinates.length) {
      const coordinate = coordinates[next];
      next += 1;
      const bytes = await renderer({
        generation: snapshot.generation,
        renderRevision: snapshot.renderRevision,
        frame: snapshot.frame,
        level: dimensions.level,
        tileX: coordinate.x,
        tileY: coordinate.y,
        tileSize: CAPTURE_TILE_SIZE,
        mode: snapshot.mode,
        processing: snapshot.processing,
        displayMin: snapshot.displayMin,
        displayMax: snapshot.displayMax,
      });
      applyPreviewPresentation(
        bytes,
        coordinate.x,
        coordinate.y,
        snapshot.mode,
        snapshot.channelRendering,
        snapshot.missingPixelAppearance,
        snapshot.demosaicDisplayExposure,
      );
      context.putImageData(
        new ImageData(
          new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength),
          CAPTURE_TILE_SIZE,
          CAPTURE_TILE_SIZE,
        ),
        coordinate.x * CAPTURE_TILE_SIZE,
        coordinate.y * CAPTURE_TILE_SIZE,
      );
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(PREVIEW_CONCURRENCY, coordinates.length) },
      () => worker(),
    ),
  );
  return canvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("png_encoding_failed"));
    }, "image/png");
  });
}

export function canvasRgba(canvas: HTMLCanvasElement): Uint8Array {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("capture_canvas_unavailable");
  return new Uint8Array(context.getImageData(0, 0, canvas.width, canvas.height).data);
}

export function drawViewportBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cssWidth: number,
  cssHeight: number,
  colors: { surface: string; pattern: string; glow: string },
): void {
  context.fillStyle = colors.surface;
  context.fillRect(0, 0, width, height);

  const scaleX = width / Math.max(1, cssWidth);
  const scaleY = height / Math.max(1, cssHeight);
  const gradient = context.createRadialGradient(
    width * 0.5,
    height * 0.42,
    0,
    width * 0.5,
    height * 0.42,
    Math.max(width, height) * 0.5,
  );
  gradient.addColorStop(0, colors.glow);
  gradient.addColorStop(1, "transparent");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const cellWidth = 6 * scaleX;
  const cellHeight = 6 * scaleY;
  context.fillStyle = colors.pattern;
  for (let y = 0, row = 0; y < height; y += cellHeight, row += 1) {
    for (let x = row % 2 === 0 ? 0 : cellWidth; x < width; x += cellWidth * 2) {
      context.fillRect(x, y, cellWidth, cellHeight);
    }
  }
}
