import type { ChannelRenderingMode } from "./channel-rendering";
import { isLanguagePreference, type LanguagePreference } from "./i18n";
import {
  DEFAULT_MISSING_PIXEL_APPEARANCE,
  isMissingPixelPattern,
  normalizeMissingPixelColor,
  type MissingPixelPattern,
} from "./missing-pixel-rendering";
import {
  DEFAULT_PIXEL_GRID_COLOR,
  normalizePixelGridColor,
} from "./pixel-grid-rendering";
import { isAppTheme, type AppTheme } from "./theme-catalog";
import type { DemosaicPixelValueMode } from "./types";

export type UiFontSize = "standard" | "large" | "extraLarge";
export type OpenView = "fit" | "actual";
export type WheelSpeed = "gentle" | "standard" | "fast";
export type TileCache = "compact" | "balanced" | "large";
export type SidebarPosition = "left" | "right";

export interface AppSettings {
  theme: AppTheme;
  uiFontSize: UiFontSize;
  reduceMotion: boolean;
  openView: OpenView;
  rememberDescriptor: boolean;
  wheelSpeed: WheelSpeed;
  tileCache: TileCache;
  language: LanguagePreference;
  sidebarWidth: number;
  sidebarPosition: SidebarPosition;
  pixelValuesEnabled: boolean;
  pixelGridColor: string;
  demosaicPixelValues: DemosaicPixelValueMode;
  channelRendering: ChannelRenderingMode;
  missingPixelPattern: MissingPixelPattern;
  missingPixelColor: string;
}

export const DEFAULT_SIDEBAR_WIDTH = 324;
export const MIN_SIDEBAR_WIDTH = 280;
export const MAX_SIDEBAR_WIDTH = 560;

export const DEFAULT_SETTINGS: Readonly<AppSettings> = {
  theme: "dark-ocean",
  uiFontSize: "standard",
  reduceMotion: false,
  openView: "fit",
  rememberDescriptor: true,
  wheelSpeed: "standard",
  tileCache: "balanced",
  language: "system",
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  sidebarPosition: "left",
  pixelValuesEnabled: true,
  pixelGridColor: DEFAULT_PIXEL_GRID_COLOR,
  demosaicPixelValues: "rgb",
  channelRendering: "color",
  missingPixelPattern: DEFAULT_MISSING_PIXEL_APPEARANCE.pattern,
  missingPixelColor: DEFAULT_MISSING_PIXEL_APPEARANCE.color,
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

export function parseAppSettings(value: unknown): AppSettings {
  const candidate = value && typeof value === "object"
    ? value as Partial<Record<keyof AppSettings, unknown>>
    : {};
  const sidebarWidth = typeof candidate.sidebarWidth === "number"
    && Number.isFinite(candidate.sidebarWidth)
    ? Math.max(
        MIN_SIDEBAR_WIDTH,
        Math.min(MAX_SIDEBAR_WIDTH, Math.trunc(candidate.sidebarWidth)),
      )
    : DEFAULT_SETTINGS.sidebarWidth;

  return {
    theme: isAppTheme(candidate.theme) ? candidate.theme : DEFAULT_SETTINGS.theme,
    uiFontSize: oneOf(
      candidate.uiFontSize,
      ["standard", "large", "extraLarge"],
      DEFAULT_SETTINGS.uiFontSize,
    ),
    reduceMotion: typeof candidate.reduceMotion === "boolean"
      ? candidate.reduceMotion
      : DEFAULT_SETTINGS.reduceMotion,
    openView: oneOf(candidate.openView, ["fit", "actual"], DEFAULT_SETTINGS.openView),
    rememberDescriptor: typeof candidate.rememberDescriptor === "boolean"
      ? candidate.rememberDescriptor
      : DEFAULT_SETTINGS.rememberDescriptor,
    wheelSpeed: oneOf(
      candidate.wheelSpeed,
      ["gentle", "standard", "fast"],
      DEFAULT_SETTINGS.wheelSpeed,
    ),
    tileCache: oneOf(
      candidate.tileCache,
      ["compact", "balanced", "large"],
      DEFAULT_SETTINGS.tileCache,
    ),
    language: isLanguagePreference(candidate.language)
      ? candidate.language
      : DEFAULT_SETTINGS.language,
    sidebarWidth,
    sidebarPosition: oneOf(
      candidate.sidebarPosition,
      ["left", "right"],
      DEFAULT_SETTINGS.sidebarPosition,
    ),
    pixelValuesEnabled: typeof candidate.pixelValuesEnabled === "boolean"
      ? candidate.pixelValuesEnabled
      : DEFAULT_SETTINGS.pixelValuesEnabled,
    pixelGridColor: normalizePixelGridColor(candidate.pixelGridColor),
    demosaicPixelValues: oneOf(
      candidate.demosaicPixelValues,
      ["rawDn", "rgb"],
      DEFAULT_SETTINGS.demosaicPixelValues,
    ),
    channelRendering: oneOf(
      candidate.channelRendering,
      ["color", "grayscale"],
      DEFAULT_SETTINGS.channelRendering,
    ),
    missingPixelPattern: isMissingPixelPattern(candidate.missingPixelPattern)
      ? candidate.missingPixelPattern
      : DEFAULT_SETTINGS.missingPixelPattern,
    missingPixelColor: normalizeMissingPixelColor(candidate.missingPixelColor),
  };
}
