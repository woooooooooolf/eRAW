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
const i18nUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
const i18n = await import(i18nUrl);
const bootstrapSource = await readFile(new URL("../src/system-language.ts", import.meta.url), "utf8");
const bootstrapJs = ts.transpileModule(bootstrapSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace('"./i18n"', JSON.stringify(i18nUrl));
const { initializeSystemLanguage } = await import(`data:text/javascript;base64,${Buffer.from(bootstrapJs).toString("base64")}`);

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

test("browser previews resolve browser language without a native request", async () => {
  await initializeSystemLanguage(null);
  assert.equal(i18n.setLanguagePreference("system"), "en");
});

test("native UI languages override browser languages in system selection and menu labels", async () => {
  await initializeSystemLanguage(async () => ["zh-Hant-TW", "en-US"]);
  assert.equal(i18n.setLanguagePreference("system"), "zh-TW");
  assert.equal(document.documentElement.lang, "zh-TW");
  assert.match(i18n.getLanguageOptions()[0].label, /繁體中文/);
  await initializeSystemLanguage(async () => ["ko-KR", "fr-FR"]);
  assert.equal(i18n.getResolvedLocale(), "fr");
});

test("explicit language survives native initialization and switching back uses native UI language", async () => {
  i18n.setLanguagePreference("de");
  await initializeSystemLanguage(async () => ["ja-JP"]);
  assert.equal(i18n.getResolvedLocale(), "de");
  assert.equal(i18n.getLanguagePreference(), "de");
  assert.equal(i18n.setLanguagePreference("system"), "ja");
});

test("native failure, malformed data and unsupported languages use English, never browser preferences", async () => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { languages: ["zh-CN"] } });
  for (const read of [
    async () => { throw new Error("IPC unavailable"); },
    async () => [], async () => ["ko-KR"], async () => null, async () => [42],
  ]) {
    await initializeSystemLanguage(read);
    assert.equal(i18n.setLanguagePreference("system"), "en");
  }
});

test("a stalled native request cannot block startup or change language after its timeout", async () => {
  let finish;
  await initializeSystemLanguage(() => new Promise(resolve => { finish = resolve; }), 15);
  assert.equal(i18n.setLanguagePreference("system"), "en");
  finish(["ja-JP"]);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(i18n.getResolvedLocale(), "en");
});

test("all desktop window routes initialize native language before creating their UI", async () => {
  const entry = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
  const initialize = entry.indexOf("await initializeSystemLanguage(");
  for (const route of ['page.get("help")', 'page.get("statistics")', "new ErawApp("]) {
    assert.ok(initialize >= 0 && initialize < entry.indexOf(route));
  }
});
