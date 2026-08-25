import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [source, appSource, viewportSource] = await Promise.all([
  readFile(new URL("../src/display-adjustment.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport.ts", import.meta.url), "utf8"),
]);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const exposure = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("shared display exposure clamps and rounds user input", () => {
  assert.equal(exposure.normalizeDisplayExposure(-99), -8);
  assert.equal(exposure.normalizeDisplayExposure(99), 8);
  assert.equal(exposure.normalizeDisplayExposure(2.26), 2.3);
  assert.equal(exposure.normalizeDisplayExposure("-0.04"), 0);
  assert.equal(exposure.normalizeDisplayExposure("invalid"), 0);
});

test("one exposure control is continuous, temporary, and available for every open document", () => {
  assert.doesNotMatch(appSource, /type="range"[^>]*display-exposure/);
  assert.match(appSource, /class="stepper-control presentation-exposure-control"/);
  assert.match(appSource, /id="decrease-display-exposure"[^>]*data-display-exposure-step="-\$\{DISPLAY_EXPOSURE_STEP\}"/);
  assert.match(appSource, /id="presentation-display-exposure" type="number"/);
  assert.match(appSource, /id="increase-display-exposure"[^>]*data-display-exposure-step="\$\{DISPLAY_EXPOSURE_STEP\}"/);
  assert.match(appSource, /this\.displayExposure \+ Number\(button\.dataset\.displayExposureStep\)/);
  assert.match(appSource, /displayExposure <= MIN_DISPLAY_EXPOSURE/);
  assert.match(appSource, /displayExposure >= MAX_DISPLAY_EXPOSURE/);
  assert.match(appSource, /this\.resetDisplayAdjustment\(info\.descriptor\.bitDepth\);\s*this\.viewport\.setDocument\(info\)/);
  assert.match(appSource, /displayAvailable = Boolean\(this\.document\)/);
  assert.doesNotMatch(appSource, /localStorage[^\n]*displayExposure/);
});

test("WebGL applies the shared exposure as a redraw-only presentation uniform", () => {
  assert.match(viewportSource, /uniform float u_display_exposure/);
  assert.match(viewportSource, /clamp\(tinted \* exp2\(u_display_exposure\), 0\.0, 1\.0\)/);
  assert.match(viewportSource, /uniform1f\(this\.displayExposureLocation, this\.displayExposure\)/);
  const setter = viewportSource.match(/setDisplayExposure\(exposure: number\)[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(setter, /this\.requestDraw\(\)/);
  assert.doesNotMatch(setter, /clearTextures|renderRevision|renderTile/);
});
