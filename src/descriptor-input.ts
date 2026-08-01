import type {
  BitAlignment,
  CfaPattern,
  Endianness,
  Packing,
  RawDescriptor,
} from "./types";

export const MAX_IMAGE_WIDTH = 25_000;
export const MAX_IMAGE_HEIGHT = 20_000;

const PACKINGS: readonly Packing[] = [
  "unpacked8",
  "unpacked16",
  "mipiRaw10",
  "mipiRaw12",
  "mipiRaw14",
];
const ENDIANNESS: readonly Endianness[] = ["little", "big"];
const BIT_ALIGNMENTS: readonly BitAlignment[] = ["lsb", "msb"];
const CFA_PATTERNS: readonly CfaPattern[] = [
  "MONO",
  "RGGB",
  "BGGR",
  "GBRG",
  "GRBG",
  "QRGGB",
  "QBGGR",
  "QGBRG",
  "QGRBG",
];

export function normalizeIntegerInput(
  value: string,
  minimum = 0,
  maximum = Number.POSITIVE_INFINITY,
): number {
  const parsed = Number(value);
  const integer = Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  return Math.max(minimum, Math.min(maximum, integer));
}

function persistedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

export function parseRawDescriptor(value: unknown, fallback: RawDescriptor): RawDescriptor {
  const candidate = value && typeof value === "object"
    ? value as Partial<Record<keyof RawDescriptor, unknown>>
    : {};
  return {
    width: persistedInteger(candidate.width, fallback.width, 1, MAX_IMAGE_WIDTH),
    height: persistedInteger(candidate.height, fallback.height, 1, MAX_IMAGE_HEIGHT),
    bitDepth: persistedInteger(candidate.bitDepth, fallback.bitDepth, 8, 16),
    packing: oneOf(candidate.packing, PACKINGS, fallback.packing),
    endianness: oneOf(candidate.endianness, ENDIANNESS, fallback.endianness),
    bitAlignment: oneOf(candidate.bitAlignment, BIT_ALIGNMENTS, fallback.bitAlignment),
    cfa: oneOf(candidate.cfa, CFA_PATTERNS, fallback.cfa),
    cfaPhaseX: persistedInteger(candidate.cfaPhaseX, fallback.cfaPhaseX, 0, 3),
    cfaPhaseY: persistedInteger(candidate.cfaPhaseY, fallback.cfaPhaseY, 0, 3),
    rowAlignment: persistedInteger(candidate.rowAlignment, fallback.rowAlignment, 1),
    rowStride: persistedInteger(candidate.rowStride, fallback.rowStride, 0),
    frameAlignment: persistedInteger(candidate.frameAlignment, fallback.frameAlignment, 1),
    frameStride: persistedInteger(candidate.frameStride, fallback.frameStride, 0),
    headerOffset: persistedInteger(candidate.headerOffset, fallback.headerOffset, 0),
  };
}
