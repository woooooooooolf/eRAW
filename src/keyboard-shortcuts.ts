import type { CfaPattern, DisplayMode } from "./types";

export interface ShortcutBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

function normalizedKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function matchesShortcut(event: ShortcutEvent, binding: ShortcutBinding): boolean {
  return normalizedKey(event.key) === normalizedKey(binding.key)
    && event.ctrlKey === Boolean(binding.ctrl)
    && event.shiftKey === Boolean(binding.shift)
    && event.altKey === Boolean(binding.alt)
    && event.metaKey === Boolean(binding.meta);
}

export function primaryDisplayModes(cfa: CfaPattern): readonly DisplayMode[] {
  if (cfa === "MONO") return ["raw"];
  return cfa.startsWith("Q")
    ? ["raw", "bayer", "remosaic", "demosaic"]
    : ["raw", "bayer", "demosaic"];
}

export function cyclePrimaryDisplayMode(
  current: DisplayMode,
  cfa: CfaPattern,
  direction: -1 | 1,
): DisplayMode {
  const modes = primaryDisplayModes(cfa);
  const currentIndex = modes.indexOf(current);
  if (currentIndex < 0 || modes.length < 2) return current;
  return modes[(currentIndex + direction + modes.length) % modes.length];
}
