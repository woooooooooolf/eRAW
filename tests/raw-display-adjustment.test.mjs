import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [source, appSource, viewportSource, captureSource, commandsSource, analysisSource] = await Promise.all([
  readFile(new URL("../src/raw-display-adjustment.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/image-capture.ts", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/commands.rs", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/analysis/mod.rs", import.meta.url), "utf8"),
]);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const rawDisplay = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("RAW display defaults and input normalization follow the current bit depth", () => {
  assert.deepEqual(rawDisplay.defaultDisplayWindow(8), { blackPoint: 0, whitePoint: 255 });
  assert.deepEqual(rawDisplay.defaultDisplayWindow(10), { blackPoint: 0, whitePoint: 1023 });
  assert.deepEqual(rawDisplay.defaultDisplayWindow(16), { blackPoint: 0, whitePoint: 65535 });
  assert.deepEqual(
    rawDisplay.updateDisplayWindow({ blackPoint: 100, whitePoint: 900 }, "blackPoint", 999, 10),
    { blackPoint: 899, whitePoint: 900 },
  );
  assert.deepEqual(
    rawDisplay.updateDisplayWindow({ blackPoint: 100, whitePoint: 900 }, "whitePoint", -1, 10),
    { blackPoint: 100, whitePoint: 101 },
  );
  assert.deepEqual(rawDisplay.normalizeDisplayWindow({ blackPoint: 10, whitePoint: 10 }, 10), {
    blackPoint: 0,
    whitePoint: 1023,
  });
});

test("automatic RAW display range prefers exact All P1/P99 and handles flat or missing frames", () => {
  assert.deepEqual(rawDisplay.automaticDisplayWindow({ p1: 12, p99: 912, minimum: 0, maximum: 1023 }, 10), {
    blackPoint: 12,
    whitePoint: 912,
  });
  assert.deepEqual(rawDisplay.automaticDisplayWindow({ p1: 77, p99: 77, minimum: 10, maximum: 100 }, 10), {
    blackPoint: 10,
    whitePoint: 100,
  });
  assert.equal(rawDisplay.automaticDisplayWindow({ p1: null, p99: null, minimum: null, maximum: null }, 10), null);
  assert.equal(rawDisplay.automaticDisplayWindow({ p1: 77, p99: 77, minimum: 77, maximum: 77 }, 10), null);
});

test("RAW adjustments affect only RAW intensity and CFA mosaic presentation", () => {
  for (const mode of ["raw", "bayer"]) {
    assert.deepEqual(rawDisplay.effectiveDisplayWindow(mode, { blackPoint: 12, whitePoint: 900 }, 10), {
      blackPoint: 12,
      whitePoint: 900,
    });
    assert.equal(rawDisplay.effectiveDisplayExposure(mode, 1.5, 2.5), 1.5);
  }
  for (const mode of ["remosaic", "red", "green", "blue", "demosaic"]) {
    assert.deepEqual(rawDisplay.effectiveDisplayWindow(mode, { blackPoint: 12, whitePoint: 900 }, 10), {
      blackPoint: 0,
      whitePoint: 1023,
    });
  }
  assert.equal(rawDisplay.effectiveDisplayExposure("demosaic", 1.5, 2.5), 2.5);
  assert.equal(rawDisplay.effectiveDisplayExposure("red", 1.5, 2.5), 0);
  assert.equal(rawDisplay.displayValueToUnit(500, { blackPoint: 100, whitePoint: 900 }, 0), 0.5);
  assert.equal(rawDisplay.displayValueToUnit(500, { blackPoint: 100, whitePoint: 900 }, 1), 1);
});

test("RAW display state is temporary, shared by RAW modes, and reset only for document boundaries or bit-depth changes", () => {
  assert.match(appSource, /Boolean\(this\.document\) && isRawDisplayMode\(this\.displayMode\)/);
  assert.match(appSource, /displayWindow: effectiveDisplayWindow\(/);
  assert.match(appSource, /this\.resetRawDisplayAdjustment\(info\.descriptor\.bitDepth\)/);
  assert.match(appSource, /previousDescriptor\.bitDepth !== info\.descriptor\.bitDepth/);
  assert.match(appSource, /private setFrame[\s\S]*?cancelRawDisplayRangeCalculation\(\)[\s\S]*?viewport\.setFrame/);
  assert.doesNotMatch(appSource, /localStorage[^\n]*(rawDisplayExposure|rawDisplayWindow)/);
});

test("exposure redraws without tile invalidation while black and white points are explicit tile-cache inputs", () => {
  const setter = viewportSource.match(/setRawDisplayExposure\(exposure: number\)[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(setter, /this\.requestDraw\(\)/);
  assert.doesNotMatch(setter, /clearTextures|renderRevision|renderTile/);
  assert.match(viewportSource, /displayWindow\.blackPoint/);
  assert.match(viewportSource, /displayWindow\.whitePoint/);
  assert.match(captureSource, /snapshot\.rawDisplayExposure/);
});

test("automatic normalization is a bounded cancellable full-frame All-DN scan", () => {
  assert.match(appSource, /calculateRawDisplayRange\(\{[\s\S]*?generation:[\s\S]*?frame/);
  assert.match(commandsSource, /display_range_revision: Arc<AtomicU64>/);
  assert.match(commandsSource, /cancel_raw_display_range/);
  assert.match(analysisSource, /for y in 0\.\.descriptor\.height[\s\S]*?for x in 0\.\.descriptor\.width/);
  assert.match(analysisSource, /read_pixel\(data, descriptor, layout, request\.frame, x, y\)/);
  assert.doesNotMatch(
    analysisSource.match(/pub fn calculate_raw_display_range[\s\S]*?\n\}/)?.[0] ?? "",
    /row_profile|column_profile|atomic_planes/,
  );
});
