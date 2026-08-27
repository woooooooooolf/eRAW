import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [
  linkSource,
  appSource,
  chartSource,
  panelSource,
  windowSource,
  viewportSource,
  overlaySource,
  styleSource,
] = await Promise.all([
  readFile(new URL("../src/statistics-link.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/statistics-chart.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/statistics-panel.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/statistics-window.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport-overlay.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
]);

const { outputText } = ts.transpileModule(linkSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const link = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

function result(overrides = {}) {
  return {
    snapshot: {
      generation: 3,
      analysisRevision: 9,
      frame: 2,
      roi: { x: 10, y: 20, width: 4, height: 3 },
      ...overrides,
    },
  };
}

function profilePoint(coordinate, mean) {
  return {
    coordinate,
    expectedCount: 1,
    validCount: mean === null ? 0 : 1,
    missingCount: mean === null ? 1 : 0,
    mean,
    standardDeviation: mean === null ? null : 0,
  };
}

test("coordinate linking starts at a fixed high-zoom threshold", () => {
  assert.equal(link.MIN_COORDINATE_HIGHLIGHT_ZOOM, 12);
  assert.equal(link.coordinateHighlightEnabled(11.999), false);
  assert.equal(link.coordinateHighlightEnabled(12), true);
  assert.equal(link.coordinateHighlightEnabled(64), true);
  assert.equal(link.coordinateHighlightEnabled(Number.NaN), false);
});

test("linked pixels are scoped to the exact analysis snapshot and ROI", () => {
  const current = result();
  const linked = link.linkedPixelForResult({ x: 11, y: 21 }, current);
  assert.deepEqual(linked, {
    generation: 3,
    analysisRevision: 9,
    frame: 2,
    point: { x: 11, y: 21 },
  });
  assert.deepEqual(link.resolveLinkedPixel(linked, current), { x: 11, y: 21 });
  assert.equal(link.linkedPixelForResult({ x: 9, y: 21 }, current), null);
  assert.equal(link.linkedPixelForResult({ x: 14, y: 21 }, current), null);
  assert.equal(link.resolveLinkedPixel(linked, result({ analysisRevision: 10 })), null);
  assert.equal(link.resolveLinkedPixel(linked, result({ frame: 1 })), null);
});

test("profile markers recover exact source coordinates instead of sampled chart points", () => {
  const points = [profilePoint(10, 100), profilePoint(12, 300), profilePoint(15, null)];
  assert.deepEqual(link.profilePointAtCoordinate(points, 12), points[1]);
  assert.deepEqual(link.profilePointAtCoordinate(points, 15), points[2]);
  assert.equal(link.profilePointAtCoordinate(points, 11), null);
  assert.equal(link.profilePointAtCoordinate([], 12), null);
});

test("high-zoom canvas linking uses soft row and column overlays without changing the viewport", () => {
  assert.match(appSource, /class="coordinate-highlight-overlay"/);
  assert.match(appSource, /this\.locatedPixel = point/);
  assert.match(appSource, /this\.pointerPixel \? null : this\.statisticsProfileHover/);
  assert.match(viewportSource, /coordinateHighlightEnabled\(this\.zoom\)/);
  assert.match(viewportSource, /onPointerPixelChange\(point\)/);
  assert.match(overlaySource, /width: imageWidth, height: 1/);
  assert.match(overlaySource, /width: 1, height: imageHeight/);
  const overlayRule = styleSource.match(/\.coordinate-highlight-overlay i \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(overlayRule, /border:\s*1px solid/);
  assert.match(overlayRule, /box-shadow:/);
  const sync = appSource.match(/private syncCoordinateLinkNow\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(sync, /this\.coordinateHighlightVisible/);
  assert.doesNotMatch(sync, /setZoom|focusPixel|applyXRange|dataZoom/);
});

test("row and column profiles exchange lightweight hover state and exact linked markers", () => {
  assert.match(appSource, /emitTo\("statistics", "statistics:link", link\)/);
  assert.match(appSource, /listen<StatisticsWindowHoverMessage>\("statistics:hover"/);
  assert.match(windowSource, /listen<StatisticsLinkedPixel \| null>\("statistics:link"/);
  assert.match(windowSource, /emit\("statistics:hover", message\)/);
  assert.match(panelSource, /resolveLinkedPixel\(link, this\.state\.result\)/);
  assert.match(chartSource, /profilePointAtCoordinate\(group\[context\.profile\], coordinate!\)/);
  assert.match(chartSource, /`\$\{chartKey\}-link-guide`/);
  assert.match(chartSource, /`\$\{chartKey\}-link-\$\{group\.key\}`/);
  assert.match(chartSource, /chart\.containPixel\(\{ gridIndex: 0 \}, point\)/);
  assert.match(chartSource, /chart\.convertFromPixel\(\{ xAxisIndex: 0 \}, point\)/);
  const apply = chartSource.match(/private applyLinkedPixel[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.doesNotMatch(apply, /dispatchAction|dataZoom/);
});
