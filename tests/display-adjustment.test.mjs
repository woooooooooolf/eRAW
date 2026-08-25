import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [source, appSource, viewportSource, captureSource, commandsSource, analysisSource, rawSource] = await Promise.all([
  readFile(new URL("../src/display-adjustment.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/image-capture.ts", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/commands.rs", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/analysis/mod.rs", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/raw/mod.rs", import.meta.url), "utf8"),
]);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const display = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("display defaults and input normalization follow the current bit depth", () => {
  assert.deepEqual(display.defaultDisplayWindow(8), { blackPoint: 0, whitePoint: 255 });
  assert.deepEqual(display.defaultDisplayWindow(10), { blackPoint: 0, whitePoint: 1023 });
  assert.deepEqual(display.defaultDisplayWindow(16), { blackPoint: 0, whitePoint: 65535 });
  assert.deepEqual(
    display.updateDisplayWindow({ blackPoint: 100, whitePoint: 900 }, "blackPoint", 999, 10),
    { blackPoint: 899, whitePoint: 900 },
  );
  assert.deepEqual(
    display.updateDisplayWindow({ blackPoint: 100, whitePoint: 900 }, "whitePoint", -1, 10),
    { blackPoint: 100, whitePoint: 101 },
  );
  assert.deepEqual(display.normalizeDisplayWindow({ blackPoint: 10, whitePoint: 10 }, 10), {
    blackPoint: 0,
    whitePoint: 1023,
  });
});

test("automatic display range prefers exact source All P1/P99 and handles flat or missing frames", () => {
  assert.deepEqual(display.automaticDisplayWindow({ p1: 12, p99: 912, minimum: 0, maximum: 1023 }, 10), {
    blackPoint: 12,
    whitePoint: 912,
  });
  assert.deepEqual(display.automaticDisplayWindow({ p1: 77, p99: 77, minimum: 10, maximum: 100 }, 10), {
    blackPoint: 10,
    whitePoint: 100,
  });
  assert.equal(display.automaticDisplayWindow({ p1: null, p99: null, minimum: null, maximum: null }, 10), null);
  assert.equal(display.automaticDisplayWindow({ p1: 77, p99: 77, minimum: 77, maximum: 77 }, 10), null);
});

test("one display window and exposure state is shared by every display mode", () => {
  assert.match(appSource, /displayWindow: normalizeDisplayWindow\(this\.displayWindow, bitDepth\)/);
  assert.match(appSource, /const displayAvailable = Boolean\(this\.document\)/);
  assert.doesNotMatch(appSource, /isRawDisplayMode|demosaicDisplayExposure|rawDisplayExposure/);
  assert.match(rawSource, /resolve_display_window\(d, &request\.display_window\)/);
  const resolver = rawSource.match(/fn resolve_display_window[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(resolver, /validate_display_window\(descriptor, window\)/);
  assert.doesNotMatch(resolver, /DisplayMode/);
  assert.equal(display.displayValueToUnit(500, { blackPoint: 100, whitePoint: 900 }, 0), 0.5);
  assert.equal(display.displayValueToUnit(500, { blackPoint: 100, whitePoint: 900 }, 1), 1);
});

test("display adjustment state is temporary and resets only at document or bit-depth boundaries", () => {
  assert.match(appSource, /this\.resetDisplayAdjustment\(info\.descriptor\.bitDepth\)/);
  assert.match(appSource, /previousDescriptor\.bitDepth !== info\.descriptor\.bitDepth/);
  assert.match(appSource, /private setFrame[\s\S]*?cancelDisplayRangeCalculation\(\)[\s\S]*?viewport\.setFrame/);
  assert.doesNotMatch(appSource, /localStorage[^\n]*(displayExposure|displayWindow)/);
});

test("exposure redraws without tile invalidation while the shared window is a tile-cache input", () => {
  const setter = viewportSource.match(/setDisplayExposure\(exposure: number\)[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(setter, /this\.requestDraw\(\)/);
  assert.doesNotMatch(setter, /clearTextures|renderRevision|renderTile/);
  assert.match(viewportSource, /displayWindow\.blackPoint/);
  assert.match(viewportSource, /displayWindow\.whitePoint/);
  assert.match(captureSource, /snapshot\.displayExposure/);
});

test("automatic normalization is a bounded cancellable full-frame source All-DN scan in every view", () => {
  const autoNormalize = appSource.match(/private async autoNormalizeDisplay[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(autoNormalize, /calculateRawDisplayRange\(\{[\s\S]*?generation:[\s\S]*?frame/);
  assert.doesNotMatch(autoNormalize, /displayMode|isRawDisplayMode/);
  assert.match(commandsSource, /display_range_revision: Arc<AtomicU64>/);
  assert.match(commandsSource, /cancel_raw_display_range/);
  assert.match(analysisSource, /for y in 0\.\.descriptor\.height[\s\S]*?for x in 0\.\.descriptor\.width/);
  assert.match(analysisSource, /read_pixel\(data, descriptor, layout, request\.frame, x, y\)/);
  assert.doesNotMatch(
    analysisSource.match(/pub fn calculate_raw_display_range[\s\S]*?\n\}/)?.[0] ?? "",
    /row_profile|column_profile|atomic_planes/,
  );
});
