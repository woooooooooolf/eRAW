import type { DisplayMode } from "./types";

export type ChannelRenderingMode = "color" | "grayscale";
export type ChannelTint = readonly [number, number, number];

const NEUTRAL_TINT: ChannelTint = [1, 1, 1];

export function channelTint(
  displayMode: DisplayMode,
  renderingMode: ChannelRenderingMode,
): ChannelTint {
  if (renderingMode === "grayscale") return NEUTRAL_TINT;
  if (displayMode === "red") return [1, 0, 0];
  if (displayMode === "green") return [0, 1, 0];
  if (displayMode === "blue") return [0, 0, 1];
  return NEUTRAL_TINT;
}
