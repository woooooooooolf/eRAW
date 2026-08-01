import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/i18n.ts", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const i18n = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: { documentElement: { lang: "" } },
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { languages: ["en-US"] },
});

test("system locale mapping follows BCP 47 language families", () => {
  const cases = [
    [["zh-Hans-CN"], "zh-CN"],
    [["zh-CN"], "zh-CN"],
    [["zh-SG"], "zh-CN"],
    [["zh-Hant-TW"], "zh-TW"],
    [["zh-HK"], "zh-TW"],
    [["ja-JP"], "ja"],
    [["es-MX"], "es"],
    [["fr-CA"], "fr"],
    [["de-AT"], "de"],
    [["en-GB"], "en"],
    [["ko-KR", "fr-FR"], "fr"],
    [["ko-KR"], "en"],
  ];
  for (const [languages, expected] of cases) {
    assert.equal(i18n.resolveSystemLocale(languages), expected, languages.join(","));
  }
});

test("every message has a non-empty translation with matching placeholders", () => {
  assert.deepEqual(i18n.validateCatalog(), []);
  for (const locale of ["en", "zh-CN", "zh-TW", "ja", "es", "fr", "de"]) {
    assert.equal(i18n.setLanguagePreference(locale), locale);
    assert.equal(document.documentElement.lang, locale);
    assert.ok(i18n.t("language.button").trim());
  }
});

test("language options use stable autonyms", () => {
  i18n.setLanguagePreference("en");
  const options = i18n.getLanguageOptions();
  assert.deepEqual(
    options.slice(1).map(({ label }) => label),
    ["English", "简体中文", "繁體中文", "日本語", "Español", "Français", "Deutsch"],
  );
});

test("statistics terminology follows each interface language", () => {
  const cases = {
    "zh-CN": ["DN 直方图", "行剖面", "均值", "保存 PNG 报告…"],
    "zh-TW": ["DN 直方圖", "列剖面", "平均值", "儲存 PNG 報告…"],
    ja: ["DN ヒストグラム", "行プロファイル", "平均", "PNG レポートを保存…"],
    es: ["Histograma de DN", "Perfil de filas", "Media", "Guardar informe PNG…"],
    fr: ["Histogramme DN", "Profil des lignes", "Moyenne", "Enregistrer le rapport PNG…"],
    de: ["DN-Histogramm", "Zeilenprofil", "Mittelwert", "PNG-Bericht speichern…"],
  };
  for (const [locale, expected] of Object.entries(cases)) {
    i18n.setLanguagePreference(locale);
    assert.deepEqual(
      [
        i18n.t("statistics.histogram"),
        i18n.t("statistics.rowProfile"),
        i18n.t("statistics.mean"),
        i18n.t("statistics.saveReport"),
      ],
      expected,
    );
  }
});

test("static interface localization uses explicit message keys", () => {
  assert.doesNotMatch(source, /keyByLocalizedText|translatedTextKey/);
  assert.match(source, /data-i18n-aria-label/);
  assert.match(appSource, /bindStaticLocalizationKeys\(\)/);
  assert.match(appSource, /dataset\.i18n = key/);
  assert.match(appSource, /attribute\("#render-status", "help", "runtime\.renderInitialHelp"\)/);
});

test("menus and parameter help expose keyboard navigation", () => {
  assert.match(appSource, /bindMenuKeyboard\("language-popover"/);
  assert.match(appSource, /event\.key === "ArrowDown"/);
  assert.match(appSource, /event\.key === "Home"/);
  assert.match(appSource, /trigger\?\.focus/);
  assert.match(appSource, /target\.addEventListener\("focus", showAtTarget\)/);
});
