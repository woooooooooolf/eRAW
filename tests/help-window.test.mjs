import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [appSource, contentSource, localizedContentSource, windowSource, statisticsWindowSource, entrySource, capabilitySource, styleSource, pixelOverlaySource, helpMathSource, packageSource, fontPolicySource] = await Promise.all([
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/help-content.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/help-content-localized.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/help-window.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/statistics-window.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/main.ts", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8"),
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../src/pixel-overlay.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/help-math.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../docs/FONT_POLICY.md", import.meta.url), "utf8"),
]);

test("help is available from the utility menu and F1 through one window lifecycle", () => {
  assert.match(appSource, /id="help-menu-item"/);
  assert.match(appSource, /event\.key === "F1"/);
  assert.ok(
    appSource.indexOf('event.key === "F1"') < appSource.indexOf("else if (this.shortcutTargetIsEditable"),
    "F1 remains available while a parameter field has focus",
  );
  assert.match(appSource, /new WebviewWindow\("help"/);
  assert.match(appSource, /url: "index\.html\?help=1"/);
  assert.match(appSource, /WebviewWindow\.getByLabel\("help"\)/);
});

test("help page is routed independently and receives language and theme updates", () => {
  assert.match(entrySource, /page\.get\("help"\) === "1"/);
  assert.match(entrySource, /import\("\.\/help-window"\)/);
  assert.match(windowSource, /listen<HelpWindowPayload>\("help:state"/);
  assert.match(windowSource, /setLanguagePreference\(payload\.language\)/);
  assert.match(windowSource, /document\.documentElement\.dataset\.theme = payload\.theme/);
  assert.match(windowSource, /help:ready/);
  assert.deepEqual(JSON.parse(capabilitySource).windows, ["main", "statistics", "help"]);
});

test("the technical manual is split into task-oriented pages", () => {
  for (const id of ["start", "workflow", "layout", "packing", "cfa", "remosaic", "demosaic", "rendering", "inspection", "statistics", "charts", "export", "boundaries", "glossary"]) {
    assert.match(contentSource, new RegExp(`id: "${id}"`));
  }
  for (const group of ["使用基础", "数据解释", "处理与呈现", "分析与输出", "边界与速查"]) {
    assert.match(contentSource, new RegExp(group));
  }
  assert.match(windowSource, /section\.hidden = section\.dataset\.helpSectionContent !== id/);
  assert.match(windowSource, /data-help-previous/);
  assert.match(windowSource, /data-help-next/);
  assert.match(windowSource, /window\.history\.pushState/);
  assert.match(windowSource, /eRAW V0\.5\.5/);
  assert.match(contentSource, /eRAW V0\.5\.5 当前实现同步/);
});

test("the technical manual renders implementation-accurate LaTeX as native MathML", () => {
  assert.ok(contentSource.includes(String.raw`\mathrm{rowBytes}=5\left\lceil\frac{W}{4}\right\rceil`));
  assert.ok(contentSource.includes(String.raw`\mathrm{DN}_i=(B_i\ll2)`));
  assert.ok(contentSource.includes(String.raw`p_x'=(p_x+\mathrm{cropX})\bmod4`));
  assert.match(contentSource, /Remosaic/);
  assert.match(contentSource, /Demosaic/);
  assert.ok(contentSource.includes(String.raw`\sigma^2&=\frac{M_{2,n}}{n}`));
  assert.ok(contentSource.includes(String.raw`\left\lceil\frac{N_{\mathrm{bin}}}{4096}\right\rceil`));
  assert.ok(contentSource.includes(String.raw`S_{\max}/2`));
  assert.ok(contentSource.includes(String.raw`0\le x_0\le x_1<W`));
  assert.match(contentSource, /replaceAll\("<", "&lt;"\)/);
  assert.match(contentSource, /replaceAll\("&", "&amp;"\)/);
  assert.match(contentSource, /EMVA 1288/);
  assert.match(contentSource, /缺失样本/);
  assert.match(contentSource, /总体方差/);
  assert.match(contentSource, /data-latex/);
  assert.match(windowSource, /renderHelpMath\(this\.root\)/);
  assert.match(helpMathSource, /output: "mathml"/);
  assert.match(helpMathSource, /render\(source, element, KATEX_OPTIONS\)/);
  assert.doesNotMatch(helpMathSource, /katex\.css/);
});

test("all seven interface locales provide a complete localized manual", () => {
  for (const catalog of ["EN_COPY", "ZH_TW_COPY", "JA_COPY", "ES_COPY", "FR_COPY", "DE_COPY"]) {
    assert.match(localizedContentSource, new RegExp(`const ${catalog}: LocaleCopy`));
  }
  for (const id of ["start", "workflow", "layout", "packing", "cfa", "remosaic", "demosaic", "rendering", "inspection", "statistics", "charts", "export", "boundaries", "glossary"]) {
    assert.ok((localizedContentSource.match(new RegExp(`\\n    ${id}: \\{`, "g")) ?? []).length >= 6, `${id} exists in all non-Chinese catalogs`);
  }
  for (const locale of ["en", "zh-TW", "ja", "es", "fr", "de"]) {
    assert.match(localizedContentSource, new RegExp(`(?:${locale === "zh-TW" ? '"zh-TW"' : locale}): [A-Z_]+_COPY`));
  }
  assert.match(localizedContentSource, /if \(locale === "zh-CN"\)/);
  assert.match(localizedContentSource, /V0\.5\.5/g);
  assert.match(windowSource, /data-help-locale="\$\{getResolvedLocale\(\)\}"/);
  assert.match(windowSource, /isLanguagePreference\(requestedLanguage\)/);
  assert.match(windowSource, /this\.catalog = getHelpCatalog\(getResolvedLocale\(\)\)/);
  assert.match(windowSource, /if \(getResolvedLocale\(\) !== previousLocale\)/);
  assert.match(windowSource, /this\.render\(\)/);
  assert.doesNotMatch(windowSource, /help-language-notice|helpWindow\.chineseReview/);
});

test("the manual uses paper-like full-width typography and semantic admonitions", () => {
  for (const kind of ["tip", "warning", "danger", "supplement"]) {
    assert.match(contentSource, new RegExp(`admonition\\("${kind}"`));
    assert.match(styleSource, new RegExp(`\\.help-admonition\\.${kind}`));
  }
  assert.match(styleSource, /--font-serif: ui-serif, serif/);
  assert.match(styleSource, /\.help-document \{[^}]*font-family: var\(--font-serif\)/s);
  assert.match(styleSource, /\.help-section \{ width: 100%; margin: 0; \}/);
  assert.doesNotMatch(styleSource, /\.help-section \{[^}]*max-width:/s);
  assert.match(styleSource, /\.help-page-header \{[^}]*padding: 6px 0 30px/s);
  assert.match(styleSource, /\.help-equation \{[^}]*border: 0/s);
});

test("independent help and statistics windows suppress native context menus", () => {
  assert.match(windowSource, /root\.addEventListener\("contextmenu", \(event\) => event\.preventDefault\(\)\)/);
  assert.match(statisticsWindowSource, /root\.addEventListener\("contextmenu", \(event\) => event\.preventDefault\(\)\)/);
  assert.match(appSource, /document\.addEventListener\("contextmenu", \(event\) => this\.onContextMenu\(event\)\)/);
});

test("the application distributes no named font or font file", () => {
  assert.match(styleSource, /font-family: system-ui, sans-serif/);
  assert.match(styleSource, /--font-serif: ui-serif, serif/);
  assert.match(styleSource, /--font-mono: ui-monospace, monospace/);
  assert.doesNotMatch(styleSource, /@font-face|Cascadia|Consolas|Segoe|Microsoft YaHei/);
  assert.match(pixelOverlaySource, /ui-monospace, monospace/);
  assert.doesNotMatch(pixelOverlaySource, /Cascadia|Consolas|Segoe|Microsoft YaHei/);
  assert.equal(JSON.parse(packageSource).dependencies.katex, "^0.18.4");
  assert.match(appSource, /<strong>KaTeX<\/strong>/);
  assert.match(appSource, /<code>MIT<\/code>/);
  assert.match(fontPolicySource, /MathML/);
  assert.match(fontPolicySource, /不导入 KaTeX 的 CSS 或 Webfont/);
});
