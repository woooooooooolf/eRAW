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
  tauriConfigSource,
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
  readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
]);
const capability = JSON.parse(capabilitySource);
const tauriConfig = JSON.parse(tauriConfigSource);

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

test("ROI selection keeps absolute coordinates and remains active for repeated right drags", () => {
  assert.match(rustSource, /for \(row_index, y\) in \(roi\.y\.\.roi\.y \+ roi\.height\)/);
  assert.match(rustSource, /cfa_site_with_phase\([\s\S]*?x,[\s\S]*?y,/);
  assert.match(viewportSource, /event\.button === 2/);
  assert.match(viewportSource, /hasExceededRoiDragThreshold/);
  assert.match(viewportSource, /selectionBeforeInteraction = this\.overlayLayer\.selection\.rect/);
  assert.match(viewportSource, /this\.overlayLayer\.setSelection\(this\.selectionBeforeInteraction\)/);
  const pointerUp = viewportSource.match(/private onPointerUp\(event: PointerEvent\): void \{[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.doesNotMatch(pointerUp, /interactionMode = "pan"/);
  assert.match(appSource, /consumeContextMenuSuppression/);
  assert.match(appSource, /event\.key === "Escape" && this\.viewport\.cancelSelection\(\)/);
  assert.match(viewportSource, /cancelSelection\(\): boolean \{[\s\S]*?this\.selectionPointerId === null[\s\S]*?this\.abortSelectionGesture\(\)/);
  const escapeSelection = appSource.match(/event\.key === "Escape" && this\.viewport\.cancelSelection\(\)[\s\S]*?\n    \}/)?.[0] ?? "";
  assert.doesNotMatch(escapeSelection, /clearRoi/);
});

test("QCFA analysis retains atomic planes while the UI consumes semantic groups", () => {
  assert.match(rustSource, /let mut atoms = \(0\.\.period_usize \* period_usize\)/);
  assert.match(rustSource, /for &group_index in group_indices\(site\)/);
  assert.match(rustSource, /usize::from\(atomic_position\.0\) \* period_usize/);
  assert.match(rustSource, /&\["all", "R", "G", "Gr", "Gb", "B"\]/);
  assert.match(rustSource, /AtomicPlaneStatistics/);
  assert.match(panelSource, /private availableGroups\(\): GroupStatistics\[\]/);
  assert.match(panelSource, /this\.viewState\.charts\[key\]\.visibleGroups/);
  assert.match(chartSource, /series: groups\.map/);
  assert.match(chartSource, /selected: Object\.fromEntries\(groups\.map/);
});

test("statistics view supports three presentations, independent curves, two-axis zoom and dormant report output", () => {
  assert.match(appSource, /new WebviewWindow\("statistics"/);
  assert.match(appSource, /class="statistics-dock"/);
  assert.match(appSource, /type StatisticsDockPlacement = "bottom" \| "side"/);
  assert.match(appSource, /toggleDockPlacement/);
  assert.match(styleSource, /\.statistics-dock-side \.canvas-area/);
  assert.match(panelSource, /statistics-sections/);
  assert.match(panelSource, /this\.chartSection\("histogram", groups, summary\)/);
  assert.match(panelSource, /this\.chartSection\("row", groups\)/);
  assert.match(panelSource, /this\.chartSection\("column", groups\)/);
  assert.match(panelSource, /data-stat-chart="\$\{key\}"/);
  assert.match(chartSource, /import\("\.\/statistics-chart-runtime"\)/);
  assert.match(chartSource, /runtime\.init/);
  assert.match(chartRuntimeSource, /AxisPointerComponent/);
  assert.match(chartRuntimeSource, /DataZoomComponent/);
  assert.match(chartSource, /type: "slider"/);
  assert.match(chartSource, /zoomOnMouseWheel:\s*"ctrl"/);
  assert.match(chartSource, /id: `\$\{chartKey\}-y-inside`[\s\S]*?zoomOnMouseWheel:\s*"shift"/);
  assert.match(chartSource, /orient: "vertical"/);
  assert.match(chartSource, /backgroundColor: "transparent"/);
  assert.match(panelSource, /data-stat-group-chart=/);
  assert.match(panelSource, /data-stat-y-reset=/);
  assert.match(panelSource, /data-stat-range-edge="start"/);
  assert.match(panelSource, /data-stat-range-edge="end"/);
  assert.match(panelSource, /data-stat-resize=/);
  assert.match(reportSource, /renderStatisticsReport/);
  assert.match(reportSource, /statistics\.disclaimer/);
  assert.doesNotMatch(panelSource, /data-stat-report|saveReport|report-preview/);
  assert.doesNotMatch(panelSource, /data-stat-tab/);
  assert.ok(capability.windows.includes("statistics"));
  assert.ok(capability.permissions.includes("core:webview:allow-create-webview-window"));
});

test("sampling-site controls start on a new line below each chart heading", () => {
  const headerRule = styleSource.match(/\.statistics-section > header \{[^}]*\}/)?.[0] ?? "";
  const headingRule = styleSource.match(/\.statistics-section-heading \{[^}]*\}/)?.[0] ?? "";
  assert.match(headerRule, /flex-wrap:\s*wrap/);
  assert.match(headingRule, /flex:\s*0 0 100%/);
});

test("statistics charts release plain wheel scrolling and state refreshes preserve the reading position", () => {
  assert.match(chartSource, /zoomOnMouseWheel:\s*"ctrl"/);
  assert.match(chartSource, /zoomOnMouseWheel:\s*"shift"/);
  assert.match(chartSource, /if \(event\.ctrlKey \|\| event\.shiftKey\) return;[\s\S]*?event\.stopPropagation\(\)/);
  assert.match(chartSource, /\{ capture: true, passive: true \}/);
  assert.match(panelSource, /private savedScrollTop = 0/);
  assert.match(panelSource, /previousBody\.scrollHeight > previousBody\.clientHeight/);
  assert.match(panelSource, /body\.scrollTop = this\.savedScrollTop/);
  assert.match(panelSource, /if \(body\.scrollHeight > body\.clientHeight\) this\.savedScrollTop = body\.scrollTop/);
  assert.match(panelSource, /resetView\(\): void \{[\s\S]*?this\.savedScrollTop = 0;[\s\S]*?this\.render\(false\)/);
  assert.match(chartSource, /statisticsAxisRangesEqual\(this\.renderedProfileRanges\.get\(chartKey\), range\)/);
});

test("statistics default to side docking and use two thirds of the available workspace", () => {
  const presentation = appSource.match(/function loadStatisticsPresentation\(\)[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(presentation, /mode: "docked"/);
  assert.match(presentation, /dock: "side"/);
  const clamp = appSource.match(/private clampStatisticsDockWidth\(width: number\)[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(clamp, /Math\.floor\(availableWidth \* 2 \/ 3\)/);
  assert.match(clamp, /availableWidth - 320/);
  assert.doesNotMatch(clamp, /620/);
});

test("curve toggles update only their chart and hover does not restyle curves", () => {
  const groupToggle = panelSource.match(/this\.root\.querySelectorAll<HTMLButtonElement>\("\[data-stat-group-chart\]"\)[\s\S]*?\n    \}\);/)?.[0] ?? "";
  assert.match(groupToggle, /this\.charts\.setGroupVisible\(key, group, visible\)/);
  assert.doesNotMatch(groupToggle, /this\.render\(\)/);
  assert.match(chartSource, /type: visible \? "legendSelect" : "legendUnSelect"/);
  assert.doesNotMatch(chartSource, /Math\.(?:min|max)\([^)]*\.\.\./);
  assert.match(chartSource, /profileSeriesData/);
  assert.match(chartSource, /shouldShowProfileMarkers/);
  assert.match(chartSource, /symbol:\s*"circle"/);
  assert.match(chartSource, /itemStyle:\s*\{ color: fill, borderColor: color/);
  assert.doesNotMatch(chartSource, /focus:\s*"series"/);
  assert.doesNotMatch(chartSource, /width: width \+ 0\.7/);
  assert.equal(
    [...chartSource.matchAll(/emphasis:\s*\{ disabled: true, lineStyle:\s*\{ width, type, color, opacity \} \}/g)].length,
    2,
  );
  assert.equal(
    [...chartSource.matchAll(/blur:\s*\{ lineStyle:\s*\{ width, type, color, opacity \} \}/g)].length,
    2,
  );
});

test("successful image-format updates reset both docked and detached statistics views transactionally", () => {
  assert.match(appSource, /IMAGE_FORMAT_DESCRIPTOR_FIELDS[\s\S]*?"width"[\s\S]*?"bitDepth"[\s\S]*?"cfaPhaseY"/);
  const commit = appSource.match(/private async commitDescriptor\(\): Promise<void> \{[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.ok(commit.indexOf("await updateDescriptor(descriptor)") < commit.indexOf("localStorage.setItem(STORAGE_KEY, JSON.stringify(info.descriptor))"));
  assert.match(commit, /resetStatisticsView = !imageFormatDescriptorsEqual/);
  assert.match(commit, /this\.statisticsViewResetRevision \+= 1/);
  assert.match(commit, /this\.descriptor = this\.document\.descriptor;[\s\S]*?this\.writeDescriptor\(this\.descriptor\)/);
  assert.match(panelSource, /state\.viewResetRevision > this\.appliedViewResetRevision/);
  assert.match(panelSource, /state\.viewResetLayout === this\.layout/);
  assert.match(panelSource, /resetStatisticsViewState\(this\.viewState, this\.layout\)/);
});

test("ROI is a main-window tool with inclusive coordinate entry and a high-contrast boundary", () => {
  assert.match(appSource, /id="roi-mouse-button"/);
  assert.match(appSource, /id="roi-coordinates-button"/);
  assert.ok(appSource.indexOf('id="roi-mouse-button"') < appSource.indexOf('id="fit-button"'));
  assert.match(appSource, /attribute\("#roi-mouse-button", "aria-label", "roi\.mouse"\)/);
  assert.match(appSource, /attribute\("#roi-coordinates-button", "aria-label", "roi\.coordinates"\)/);
  assert.match(appSource, /attribute\("#statistics-resizer", "aria-label", "statistics\.resizePanel"\)/);
  assert.match(appSource, /class="toolbar-separator"/);
  assert.match(appSource, /private roiSource: "mouse" \| "coordinates" \| null/);
  assert.match(appSource, /if \(this\.roiSource === "mouse"\) this\.clearRoi\(\)/);
  assert.match(appSource, /if \(this\.roiSource === "coordinates" && this\.viewport\.getSelection\(\)\) this\.clearRoi\(\)/);
  assert.match(appSource, /validateRoiCoordinates/);
  assert.match(appSource, /const selection = this\.viewport\.getSelection\(\);[\s\S]*?return selection \?\?/);
  assert.doesNotMatch(appSource, /statisticsUseSelection/);
  assert.match(appSource, /class="image-selection-overlay"/);
  const rule = styleSource.match(/\.image-selection-overlay\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(rule, /border:\s*3px dashed/);
  assert.match(rule, /rgb\(0 0 0/);
  assert.match(rule, /rgb\(255 255 255/);
  assert.match(rule, /pointer-events:\s*none/);
  assert.match(appSource, /Boolean\(selection\) \|\| this\.viewport\.getInteractionMode\(\) === "select"/);
  assert.match(appSource, /<strong>Apache ECharts<\/strong>[\s\S]*?<code>Apache-2\.0<\/code>/);
});

test("ROI, pixel, zoom, statistics and capture actions expose the agreed shortcuts", () => {
  assert.match(appSource, /event\.shiftKey && event\.key\.toLowerCase\(\) === "r"/);
  assert.match(appSource, /!event\.shiftKey && event\.key\.toLowerCase\(\) === "r"/);
  assert.match(appSource, /event\.key\.toLowerCase\(\) === "p"/);
  assert.match(appSource, /event\.key\.toLowerCase\(\) === "z"/);
  assert.match(appSource, /event\.key\.toLowerCase\(\) === "i"/);
  assert.match(appSource, /performImageCapture\("preview", "save"\)/);
  assert.match(appSource, /performImageCapture\("preview", "copy"\)/);
  assert.match(appSource, /performImageCapture\("current", "save"\)/);
  assert.match(appSource, /performImageCapture\("current", "copy"\)/);
  assert.match(appSource, /<span>鼠标框选 ROI<\/span><kbd>R<\/kbd>/);
  assert.match(appSource, /<span>输入坐标 ROI<\/span><kbd>Shift<\/kbd><kbd>R<\/kbd>/);
  assert.match(appSource, /<span>定位像素<\/span><kbd>P<\/kbd>/);
  assert.match(appSource, /<span>输入缩放比例<\/span><kbd>Z<\/kbd>/);
  assert.match(appSource, /<span>打开图像统计<\/span><kbd>Ctrl<\/kbd><kbd>I<\/kbd>/);
});

test("detached statistics window relies on the native title bar and uses explicit dock semantics", () => {
  assert.equal(tauriConfig.app.windows[0].title, "eRAW");
  assert.match(appSource, /document\.title = "eRAW"/);
  assert.match(appSource, /title: `eRAW - \$\{t\("statistics\.title"\)\}`/);
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
  assert.match(reset, /resetStatisticsViewState\(this\.viewState, this\.layout\)/);
  assert.match(reset, /this\.savedScrollTop = 0/);
  assert.doesNotMatch(reset, /activeTab|cumulative|logarithmic|profileMetric/);
  assert.doesNotMatch(reset, /clearRoi|analyzeRawImage|requestStatistics|saveReport/);
});
