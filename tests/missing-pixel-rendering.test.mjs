import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/missing-pixel-rendering.ts", import.meta.url), "utf8");
const [appSource, viewportSource, rustSource] = await Promise.all([
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport.ts", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/raw/mod.rs", import.meta.url), "utf8"),
]);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const missingPixels = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("missing-data appearance has safe defaults and validates persisted values", () => {
  assert.deepEqual(missingPixels.DEFAULT_MISSING_PIXEL_APPEARANCE, {
    pattern: "darkCheckerboard",
    color: "#808080",
  });
  for (const pattern of ["darkCheckerboard", "lightCheckerboard", "solid"]) {
    assert.equal(missingPixels.isMissingPixelPattern(pattern), true);
  }
  assert.equal(missingPixels.isMissingPixelPattern("diagnostic"), false);
  assert.equal(missingPixels.normalizeMissingPixelColor("#A1b2C3"), "#a1b2c3");
  assert.equal(missingPixels.normalizeMissingPixelColor("red"), "#808080");
  assert.deepEqual(missingPixels.hexColorToUnitRgb("#ff8000"), [1, 128 / 255, 0]);
});

test("presentation controls live in the sidebar and persist immediately", () => {
  assert.match(appSource, /id="presentation-section"[\s\S]*?>画面呈现</);
  assert.match(appSource, /id="presentation-channel-rendering"/);
  assert.match(appSource, /id="presentation-pixel-values"/);
  assert.match(appSource, /id="presentation-pixel-grid-color"/);
  assert.match(appSource, /id="presentation-demosaic-pixel-values"/);
  assert.match(appSource, /id="presentation-missing-pixel-pattern"/);
  assert.match(appSource, /id="presentation-missing-pixel-color"/);
  assert.doesNotMatch(appSource, /id="setting-channel-rendering"/);
  assert.doesNotMatch(appSource, /id="setting-pixel-values"/);
  assert.match(
    appSource,
    /private savePresentationSettings\(\)[\s\S]*?this\.persistSettings\(\)[\s\S]*?this\.viewport\.setMissingPixelAppearance/,
  );
});

test("missing source pixels use a dedicated marker and presentation-only shader uniforms", () => {
  assert.match(rustSource, /copy_from_slice\(&\[0, 0, 0, 254\]\)/);
  assert.match(viewportSource, /abs\(color\.a - 254\.0 \/ 255\.0\)/);
  assert.match(viewportSource, /uniform int u_missing_pattern/);
  assert.match(viewportSource, /uniform vec3 u_missing_color/);
  assert.match(viewportSource, /setMissingPixelAppearance\(appearance: MissingPixelAppearance\)/);
  assert.match(viewportSource, /this\.requestDraw\(\)/);
  assert.doesNotMatch(viewportSource, /setMissingPixelAppearance[\s\S]{0,400}clearTextures/);
});

test("checkerboard phase is based on global image texels", () => {
  assert.match(viewportSource, /ivec2 image_texel = ivec2\(floor\(v_image_point \/ texel_span\)\)/);
  assert.match(viewportSource, /ivec2 checker_cell = image_texel \/ 12/);
});
