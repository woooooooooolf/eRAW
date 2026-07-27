export type Packing = "unpacked8" | "unpacked16" | "mipiRaw10" | "mipiRaw12" | "mipiRaw14";
export type Endianness = "little" | "big";
export type BitAlignment = "lsb" | "msb";
export type CfaPattern =
  | "MONO"
  | "RGGB"
  | "BGGR"
  | "GBRG"
  | "GRBG"
  | "QRGGB"
  | "QBGGR"
  | "QGBRG"
  | "QGRBG";
export type WarningSeverity = "info" | "warning" | "error";
export type DisplayMode = "raw" | "bayer" | "remosaic" | "demosaic" | "red" | "green" | "blue";
export type DemosaicPixelValueMode = "rawDn" | "rgb";
export type DemosaicAlgorithm = "bilinear";

export interface RemosaicOptions {
  sameColorReconstruction: boolean;
}

export interface ProcessingSettings {
  demosaicAlgorithm: DemosaicAlgorithm;
  remosaic: RemosaicOptions;
}

export interface RawDescriptor {
  width: number;
  height: number;
  bitDepth: number;
  packing: Packing;
  endianness: Endianness;
  bitAlignment: BitAlignment;
  cfa: CfaPattern;
  cfaPhaseX: number;
  cfaPhaseY: number;
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
  processing: ProcessingSettings;
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
  processing: ProcessingSettings;
}

export interface PixelSample {
  x: number;
  y: number;
  value: number | null;
  channel: string;
}

export type ValueMapping = "preserve" | "scaleFullRange";
export type ExportTarget = "originalCfa" | "remosaic" | "demosaic";

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
  target: ExportTarget;
  processing: ProcessingSettings;
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
  rgb: number;
}

export interface ExportResult {
  bytesWritten: number;
  clippedValues: number;
  filledPixels: MissingPixelCounts;
  outputCfa: CfaPattern | null;
  outputCfaPhaseX: number;
  outputCfaPhaseY: number;
  outputChannels: number;
  outputBitDepth: number;
}

export const DEFAULT_DESCRIPTOR: RawDescriptor = {
  width: 1920,
  height: 1080,
  bitDepth: 10,
  packing: "unpacked16",
  endianness: "little",
  bitAlignment: "lsb",
  cfa: "RGGB",
  cfaPhaseX: 0,
  cfaPhaseY: 0,
  rowAlignment: 1,
  rowStride: 0,
  frameAlignment: 1,
  frameStride: 0,
  headerOffset: 0,
};

export const DEFAULT_PROCESSING_SETTINGS: ProcessingSettings = {
  demosaicAlgorithm: "bilinear",
  remosaic: {
    sameColorReconstruction: false,
  },
};

export function isQuadCfa(cfa: CfaPattern): boolean {
  return cfa.startsWith("Q");
}

export function isColorCfa(cfa: CfaPattern): boolean {
  return cfa !== "MONO";
}
