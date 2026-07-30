import type { Packing } from "./types";

export interface PackingControlState {
  bitDepth: number;
  bitDepthLocked: boolean;
  endiannessVisible: boolean;
  bitAlignmentVisible: boolean;
}

const FIXED_BIT_DEPTHS: Partial<Record<Packing, number>> = {
  unpacked8: 8,
  mipiRaw10: 10,
  mipiRaw12: 12,
  mipiRaw14: 14,
};

export function packingControlState(packing: Packing, bitDepth: number): PackingControlState {
  const fixedBitDepth = FIXED_BIT_DEPTHS[packing];
  const effectiveBitDepth = fixedBitDepth ?? bitDepth;
  const unpacked16 = packing === "unpacked16";
  return {
    bitDepth: effectiveBitDepth,
    bitDepthLocked: fixedBitDepth !== undefined,
    endiannessVisible: unpacked16,
    bitAlignmentVisible: unpacked16 && effectiveBitDepth < 16,
  };
}
