import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function transpile(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function dataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

const [i18nSource, missingSource, themeSource, settingsSource] = await Promise.all([
  transpile("../src/i18n.ts"),
  transpile("../src/missing-pixel-rendering.ts"),
  transpile("../src/theme-catalog.ts"),
  transpile("../src/app-settings.ts"),
]);
const settingsWithDependencies = settingsSource
  .replaceAll('"./i18n"', JSON.stringify(dataUrl(i18nSource)))
  .replaceAll('"./missing-pixel-rendering"', JSON.stringify(dataUrl(missingSource)))
  .replaceAll('"./theme-catalog"', JSON.stringify(dataUrl(themeSource)));
const settings = await import(dataUrl(settingsWithDependencies));

test("legacy settings gain new presentation defaults without losing valid values", () => {
  const parsed = settings.parseAppSettings({
    theme: "dark-violet",
    language: "fr",
    sidebarWidth: 412.9,
    openView: "actual",
  });

  assert.equal(parsed.theme, "dark-violet");
  assert.equal(parsed.language, "fr");
  assert.equal(parsed.sidebarWidth, 412);
  assert.equal(parsed.openView, "actual");
  assert.equal(parsed.missingPixelPattern, "darkCheckerboard");
  assert.equal(parsed.missingPixelColor, "#808080");
});

test("new themes and presentation preferences survive settings parsing", () => {
  const parsed = settings.parseAppSettings({
    theme: "light-flat",
    channelRendering: "grayscale",
    missingPixelPattern: "solid",
    missingPixelColor: "#A1b2C3",
  });

  assert.equal(parsed.theme, "light-flat");
  assert.equal(parsed.channelRendering, "grayscale");
  assert.equal(parsed.missingPixelPattern, "solid");
  assert.equal(parsed.missingPixelColor, "#a1b2c3");
});

test("invalid settings fall back and sidebar width stays bounded", () => {
  const invalid = settings.parseAppSettings({
    theme: "unknown",
    language: "ko",
    wheelSpeed: "instant",
    missingPixelColor: "red",
    sidebarWidth: Number.NaN,
  });
  assert.deepEqual(invalid, settings.DEFAULT_SETTINGS);

  assert.equal(
    settings.parseAppSettings({ sidebarWidth: -100 }).sidebarWidth,
    settings.MIN_SIDEBAR_WIDTH,
  );
  assert.equal(
    settings.parseAppSettings({ sidebarWidth: 10_000 }).sidebarWidth,
    settings.MAX_SIDEBAR_WIDTH,
  );
  assert.deepEqual(settings.parseAppSettings(null), settings.DEFAULT_SETTINGS);
});
