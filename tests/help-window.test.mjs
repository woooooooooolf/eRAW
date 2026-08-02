import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [appSource, contentSource, windowSource, statisticsWindowSource, entrySource, capabilitySource, styleSource, pixelOverlaySource] = await Promise.all([
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/help-content.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/help-window.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/statistics-window.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/main.ts", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8"),
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../src/pixel-overlay.ts", import.meta.url), "utf8"),
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
  assert.match(windowSource, /listen<HelpWindowPayload>\("help:state"/);
  assert.match(windowSource, /setLanguagePreference\(payload\.language\)/);
  assert.match(windowSource, /document\.documentElement\.dataset\.theme = payload\.theme/);
  assert.match(windowSource, /help:ready/);
  assert.deepEqual(JSON.parse(capabilitySource).windows, ["main", "statistics", "help"]);
});

test("the Chinese technical manual is split into task-oriented pages", () => {
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
  assert.match(windowSource, /eRAW V0\.5\.2/);
  assert.match(contentSource, /eRAW V0\.5\.2 当前实现同步/);
});

test("the technical manual documents implementation-accurate formulas and boundaries", () => {
  assert.match(contentSource, /rowBytes = 5 · ceil\(W \/ 4\)/);
  assert.match(contentSource, /DNᵢ = \(Bᵢ &lt;&lt; 2\)/);
  assert.match(contentSource, /phaseX′ = \(phaseX \+ cropX\) mod 4/);
  assert.match(contentSource, /Remosaic/);
  assert.match(contentSource, /Demosaic/);
  assert.match(contentSource, /M2ₙ = M2ₙ₋₁/);
  assert.match(contentSource, /variance = M2ₙ \/ n/);
  assert.match(contentSource, /bucketSize = max\(1, ceil\(exactBinCount \/ 4096\)\)/);
  assert.match(contentSource, /sourceMax\/2/);
  assert.match(contentSource, /EMVA 1288/);
  assert.match(contentSource, /缺失样本/);
  assert.match(contentSource, /总体方差/);
});

test("independent help and statistics windows suppress native context menus", () => {
  assert.match(windowSource, /root\.addEventListener\("contextmenu", \(event\) => event\.preventDefault\(\)\)/);
  assert.match(statisticsWindowSource, /root\.addEventListener\("contextmenu", \(event\) => event\.preventDefault\(\)\)/);
  assert.match(appSource, /document\.addEventListener\("contextmenu", \(event\) => this\.onContextMenu\(event\)\)/);
});

test("the application distributes no named font or font file", () => {
  assert.match(styleSource, /font-family: system-ui, sans-serif/);
  assert.match(styleSource, /--font-mono: ui-monospace, monospace/);
  assert.doesNotMatch(styleSource, /@font-face|Cascadia|Consolas|Segoe|Microsoft YaHei/);
  assert.match(pixelOverlaySource, /ui-monospace, monospace/);
  assert.doesNotMatch(pixelOverlaySource, /Cascadia|Consolas|Segoe|Microsoft YaHei/);
});
