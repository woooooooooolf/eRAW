import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  appSource,
  apiSource,
  panelSource,
  chartSource,
  chartRuntimeSource,
  reportSource,
  windowSource,
  viewportSource,
  rustSource,
  commandSource,
  capabilitySource,
  styleSource,
] = await Promise.all([
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/statistics-panel.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/statistics-chart.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/statistics-chart-runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/statistics-report.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/statistics-window.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport.ts", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/analysis/mod.rs", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/commands.rs", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8"),
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
]);
const capability = JSON.parse(capabilitySource);

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
  assert.match(chartSource, /\["all", "R", "Gr", "Gb", "B"\]/);
});

test("statistics view supports docking, detaching, vertical interactive charts and dormant report output", () => {
  assert.match(appSource, /new WebviewWindow\("statistics"/);
  assert.match(appSource, /class="statistics-dock"/);
  assert.match(panelSource, /statistics-sections/);
  assert.match(panelSource, /data-stat-chart="histogram"/);
  assert.match(panelSource, /data-stat-chart="row"/);
  assert.match(panelSource, /data-stat-chart="column"/);
  assert.match(chartSource, /import\("\.\/statistics-chart-runtime"\)/);
  assert.match(chartSource, /runtime\.init/);
  assert.match(chartRuntimeSource, /AxisPointerComponent/);
  assert.match(chartRuntimeSource, /DataZoomComponent/);
  assert.match(chartSource, /type: "slider"/);
  assert.match(chartSource, /backgroundColor: "transparent"/);
  assert.match(reportSource, /renderStatisticsReport/);
  assert.match(reportSource, /statistics\.disclaimer/);
  assert.doesNotMatch(panelSource, /data-stat-report|saveReport|report-preview/);
  assert.doesNotMatch(panelSource, /data-stat-tab/);
  assert.ok(capability.windows.includes("statistics"));
  assert.ok(capability.permissions.includes("core:webview:allow-create-webview-window"));
});

test("ROI is a main-window tool with inclusive coordinate entry and a high-contrast boundary", () => {
  assert.match(appSource, /id="roi-control"/);
  assert.ok(appSource.indexOf('id="roi-control"') < appSource.indexOf('id="fit-button"'));
  assert.match(appSource, /class="toolbar-separator"/);
  assert.match(appSource, /data-roi-action="mouse"/);
  assert.match(appSource, /data-roi-action="coordinates"/);
  assert.match(appSource, /validateRoiCoordinates/);
  assert.match(appSource, /const selection = this\.viewport\.getSelection\(\);[\s\S]*?return selection \?\?/);
  assert.doesNotMatch(appSource, /statisticsUseSelection/);
  const rule = styleSource.match(/\.image-selection\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(rule, /stroke-width:\s*3px/);
  assert.match(rule, /stroke-dasharray:\s*8 4/);
  assert.match(rule, /drop-shadow/);
});

test("detached statistics window relies on the native title bar and uses explicit dock semantics", () => {
  assert.match(panelSource, /const presentationAction = this\.options\.detached \? "dock" : "detach"/);
  assert.match(panelSource, /this\.options\.detached \? "" : `<button type="button" data-stat-action="close"/);
  assert.doesNotMatch(panelSource, /statistics-header|statistics-title/);
  assert.match(windowSource, /await this\.emitAction\(action\)/);
  assert.match(windowSource, /action === "close" \|\| action === "dock"/);
  assert.match(windowSource, /event\.preventDefault\(\)[\s\S]*?this\.handleAction\("close"\)/);
  assert.match(windowSource, /await this\.appWindow\.destroy\(\)/);
  assert.doesNotMatch(windowSource, /this\.appWindow\.close\(\)/);
  assert.match(windowSource, /emit\("statistics:action", message\)/);
  assert.doesNotMatch(windowSource, /emitTo\("main", "statistics:action"/);
  assert.match(appSource, /if \(action === "dock"\)[\s\S]*?this\.statisticsDetached = false/);
  assert.match(appSource, /source === "main"/);
  assert.ok(capability.permissions.includes("core:window:allow-destroy"));
});

test("reset view does not clear ROI or trigger a backend scan", () => {
  const reset = panelSource.match(/resetView\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(reset, /selectedGroup = "all"/);
  assert.doesNotMatch(reset, /activeTab|cumulative|logarithmic|profileMetric/);
  assert.doesNotMatch(reset, /clearRoi|analyzeRawImage|requestStatistics|saveReport/);
});
