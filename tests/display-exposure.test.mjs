import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [source, appSource, viewportSource] = await Promise.all([
  readFile(new URL("../src/display-exposure.ts", import.meta.url), "utf8"),
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

test("Demosaic display exposure clamps and rounds user input", () => {
  assert.equal(exposure.normalizeDemosaicDisplayExposure(-99), -8);
  assert.equal(exposure.normalizeDemosaicDisplayExposure(99), 8);
  assert.equal(exposure.normalizeDemosaicDisplayExposure(2.26), 2.3);
  assert.equal(exposure.normalizeDemosaicDisplayExposure("-0.04"), 0);
  assert.equal(exposure.normalizeDemosaicDisplayExposure("invalid"), 0);
});

test("exposure affects only full-color Demosaic display values", () => {
  assert.equal(exposure.applyDemosaicDisplayExposure(64, "demosaic", 1), 128);
  assert.equal(exposure.applyDemosaicDisplayExposure(200, "demosaic", 1), 255);
  for (const mode of ["raw", "bayer", "remosaic", "red", "green", "blue"]) {
    assert.equal(exposure.applyDemosaicDisplayExposure(64, mode, 4), 64);
  }
});

test("the exposure control is continuous, temporary, and resets for a new document", () => {
  assert.match(appSource, /id="presentation-demosaic-exposure-range"[^>]*min="\$\{MIN_DEMOSAIC_DISPLAY_EXPOSURE\}"[^>]*step="\$\{DEMOSAIC_DISPLAY_EXPOSURE_STEP\}"/);
  assert.match(appSource, /id="presentation-demosaic-exposure" type="number"/);
  assert.match(appSource, /this\.setDemosaicDisplayExposure\(0\);\s*this\.viewport\.setDocument\(info\)/);
  assert.match(appSource, /exposureAvailable = Boolean\(this\.document\) && this\.displayMode === "demosaic"/);
  assert.doesNotMatch(appSource, /localStorage[^\n]*demosaicDisplayExposure/);
});

test("WebGL applies exposure as a redraw-only Demosaic presentation uniform", () => {
  assert.match(viewportSource, /uniform float u_demosaic_exposure/);
  assert.match(viewportSource, /clamp\(tinted \* exp2\(u_demosaic_exposure\), 0\.0, 1\.0\)/);
  assert.match(viewportSource, /effectiveDemosaicDisplayExposure\(this\.settings\.mode, this\.demosaicDisplayExposure\)/);
  const setter = viewportSource.match(/setDemosaicDisplayExposure\(exposure: number\)[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(setter, /this\.requestDraw\(\)/);
  assert.doesNotMatch(setter, /clearTextures|renderRevision|renderTile/);
});
