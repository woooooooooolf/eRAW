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

test("the Chinese manual covers the complete approved chapter framework", () => {
  for (const id of ["start", "document", "interface", "descriptor", "presentation", "processing", "roi-statistics", "export", "settings", "shortcuts", "troubleshooting"]) {
    assert.match(contentSource, new RegExp(`id: "${id}"`));
  }
  assert.match(contentSource, /Remosaic/);
  assert.match(contentSource, /Demosaic/);
  assert.match(contentSource, /EMVA 1288/);
  assert.match(contentSource, /缺失样本/);
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
