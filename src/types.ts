export type Packing = "unpacked8" | "unpacked16" | "mipiRaw10" | "mipiRaw12" | "mipiRaw14";
export type Endianness = "little" | "big";
export type BitAlignment = "lsb" | "msb";
export type CfaPattern = "MONO" | "RGGB" | "BGGR" | "GBRG" | "GRBG";
export type WarningSeverity = "info" | "warning" | "error";
export type DisplayMode = "raw" | "bayer" | "demosaic" | "red" | "green" | "blue";
export type DemosaicPixelValueMode = "rawDn" | "rgb";

export interface RawDescriptor {
  width: number;
  height: number;
  bitDepth: number;
  packing: Packing;
  endianness: Endianness;
  bitAlignment: BitAlignment;
  cfa: CfaPattern;
  rowAlignment: number;
  rowStride: number;
  frameAlignment: number;
  frameStride: number;
  headerOffset: number;
}

export interface RawLayout {
  rowBytes: number;
  rowStride: number;
  frameBytes: number;
  frameStride: number;
  frameCount: number;
  completeFrameCount: number;
  trailingBytes: number;
}

export interface RawWarning {
  severity: WarningSeverity;
  code: string;
  message: string;
}

export interface DocumentInfo {
  path: string;
  name: string;
  fileSize: number;
  descriptor: RawDescriptor;
  layout: RawLayout;
  warnings: RawWarning[];
  generation: number;
}

export interface TileRequest {
  generation: number;
  frame: number;
  level: number;
  tileX: number;
  tileY: number;
  tileSize: number;
  mode: DisplayMode;
  displayMin: number;
  displayMax: number;
}

export interface PixelInspectionRequest {
  generation: number;
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
  mode: DisplayMode;
}

export interface PixelSample {
  x: number;
  y: number;
  value: number | null;
  channel: string;
}

export type ValueMapping = "preserve" | "scaleFullRange";

export interface MissingPixelFill {
  mono: number;
  red: number;
  greenBlue: number;
  greenRed: number;
  blue: number;
}

export interface ExportRequest {
  path: string;
  sourcePath: string;
  sourceGeneration: number;
  sourceDescriptor: RawDescriptor;
  currentFrame: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  packing: Packing;
  bitDepth: number;
  endianness: Endianness;
  bitAlignment: BitAlignment;
  rowAlignment: number;
  frameAlignment: number;
  valueMapping: ValueMapping;
  missingPixelFill: MissingPixelFill;
}

export interface MissingPixelCounts {
  mono: number;
  red: number;
  greenBlue: number;
  greenRed: number;
  blue: number;
}

export interface ExportResult {
  bytesWritten: number;
  clippedValues: number;
  filledPixels: MissingPixelCounts;
  outputCfa: CfaPattern;
}

export const DEFAULT_DESCRIPTOR: RawDescriptor = {
  width: 1920,
  height: 1080,
  bitDepth: 10,
  packing: "unpacked16",
  endianness: "little",
  bitAlignment: "lsb",
  cfa: "RGGB",
  rowAlignment: 1,
  rowStride: 0,
  frameAlignment: 1,
  frameStride: 0,
  headerOffset: 0,
};
