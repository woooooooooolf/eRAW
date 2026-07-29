export const THEMES = [
  { id: "dark-ocean", name: "深海蓝", tone: "深色", background: "#070a0f", surface: "#131b26", accent: "#52caf4" },
  { id: "dark-violet", name: "曜石紫", tone: "深色", background: "#0a0810", surface: "#1b1726", accent: "#a890ff" },
  { id: "dark-amber", name: "琥珀黑", tone: "深色", background: "#0d0b08", surface: "#221b12", accent: "#efb65b" },
  { id: "light-frost", name: "极昼蓝", tone: "浅色", background: "#e9eff4", surface: "#ffffff", accent: "#087dab" },
  { id: "light-mint", name: "薄荷白", tone: "浅色", background: "#e8f1ee", surface: "#fbfffd", accent: "#168b72" },
  { id: "light-sand", name: "暖砂白", tone: "浅色", background: "#f2ede5", surface: "#fffdf9", accent: "#a46117" },
  { id: "dark-contrast", name: "高对比黑", tone: "深色", background: "#000000", surface: "#101010", accent: "#00e5ff" },
  { id: "dark-flat", name: "石墨扁平", tone: "深色", background: "#17191d", surface: "#24272d", accent: "#5aa7ff" },
  { id: "light-flat", name: "雾白扁平", tone: "浅色", background: "#e7e9ed", surface: "#f7f8fa", accent: "#4e6fd0" },
] as const satisfies ReadonlyArray<{
  id: string;
  name: string;
  tone: "深色" | "浅色";
  background: string;
  surface: string;
  accent: string;
}>;

export type AppTheme = typeof THEMES[number]["id"];

export type ThemeMessageKey =
  | "theme.darkOcean"
  | "theme.darkViolet"
  | "theme.darkAmber"
  | "theme.lightFrost"
  | "theme.lightMint"
  | "theme.lightSand"
  | "theme.darkContrast"
  | "theme.darkFlat"
  | "theme.lightFlat";

const THEME_MESSAGE_KEYS: Record<AppTheme, ThemeMessageKey> = {
  "dark-ocean": "theme.darkOcean",
  "dark-violet": "theme.darkViolet",
  "dark-amber": "theme.darkAmber",
  "light-frost": "theme.lightFrost",
  "light-mint": "theme.lightMint",
  "light-sand": "theme.lightSand",
  "dark-contrast": "theme.darkContrast",
  "dark-flat": "theme.darkFlat",
  "light-flat": "theme.lightFlat",
};

export function isAppTheme(value: unknown): value is AppTheme {
  return THEMES.some((theme) => theme.id === value);
}

export function themeMessageKey(theme: AppTheme): ThemeMessageKey {
  return THEME_MESSAGE_KEYS[theme];
}
