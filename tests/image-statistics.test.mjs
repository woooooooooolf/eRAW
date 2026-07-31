import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  appSource,
  apiSource,
  panelSource,
  viewportSource,
  rustSource,
  commandSource,
  capabilitySource,
] = await Promise.all([
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/statistics-panel.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport.ts", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/analysis/mod.rs", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/commands.rs", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8"),
]);

test("canvas context menu exposes one statistics entry before the four capture actions", () => {
  const menu = appSource.match(/<div id="canvas-context-menu"[\s\S]*?<\/div>/)?.[0] ?? "";
  assert.match(menu, /data-statistics-open/);
  assert.ok(menu.indexOf("data-statistics-open") < menu.indexOf("data-capture-kind"));
  assert.equal([...menu.matchAll(/data-capture-kind=/g)].length, 4);
});

test("statistics requests use an independent revision and L0 raw analysis command", () => {
  assert.match(apiSource, /invoke\("analyze_raw_image", \{ request \}\)/);
  assert.match(commandSource, /analysis_revision:\s*Arc<AtomicU64>/);
  assert.match(commandSource, /generation_clock\.load\(Ordering::Acquire\) == request\.generation/);
  assert.match(commandSource, /analysis_revision\.load\(Ordering::Acquire\) == request\.analysis_revision/);
  assert.doesNotMatch(rustSource, /DisplayMode|demosaic|remosaic/i);
  assert.match(rustSource, /read_pixel\(data, descriptor, layout, request\.frame, x, y\)/);
});

test("ROI selection keeps absolute coordinates and Escape restores the previous selection", () => {
  assert.match(rustSource, /for \(row_index, y\) in \(roi\.y\.\.roi\.y \+ roi\.height\)/);
  assert.match(rustSource, /cfa_site_with_phase\([\s\S]*?x,[\s\S]*?y,/);
  assert.match(viewportSource, /selectionBeforeInteraction = this\.overlayLayer\.selection\.rect/);
  assert.match(viewportSource, /this\.overlayLayer\.setSelection\(this\.selectionBeforeInteraction\)/);
  assert.match(appSource, /event\.key === "Escape" && this\.viewport\.cancelSelection\(\)/);
});

test("QCFA analysis retains atomic planes while the UI consumes semantic groups", () => {
  assert.match(rustSource, /let mut atoms = \(0\.\.period\)/);
  assert.match(rustSource, /&\["all", "R", "G", "Gr", "Gb", "B"\]/);
  assert.match(rustSource, /AtomicPlaneStatistics/);
  assert.match(panelSource, /selectedGroup = "all"/);
  assert.match(panelSource, /\["all", "R", "Gr", "Gb", "B"\]/);
});

test("statistics view supports docking, detaching, charts and structured report output", () => {
  assert.match(appSource, /new WebviewWindow\("statistics"/);
  assert.match(appSource, /class="statistics-dock"/);
  assert.match(panelSource, /drawHistogram/);
  assert.match(panelSource, /drawProfile/);
  assert.match(panelSource, /drawReport/);
  assert.match(panelSource, /not an EMVA 1288 compliant measurement|statistics\.disclaimer/);
  const capability = JSON.parse(capabilitySource);
  assert.ok(capability.windows.includes("statistics"));
  assert.ok(capability.permissions.includes("core:webview:allow-create-webview-window"));
});

test("reset view does not clear ROI or trigger a backend scan", () => {
  const reset = panelSource.match(/resetView\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(reset, /selectedGroup = "all"/);
  assert.match(reset, /cumulative = false/);
  assert.doesNotMatch(reset, /clearRoi|analyzeRawImage|requestStatistics/);
});
