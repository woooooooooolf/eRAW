import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

function dataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

const overlaySource = await readFile(
  new URL("../src/pixel-overlay.ts", import.meta.url),
  "utf8",
);
const apiUrl = dataUrl(`
  export const inspectionCalls = [];
  export function inspectPixels(request) {
    inspectionCalls.push(request);
    return Promise.resolve(new Uint8Array());
  }
`);
const pixelGridSource = ts.transpileModule(
  await readFile(new URL("../src/pixel-grid-rendering.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { outputText } = ts.transpileModule(overlaySource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const runnableSource = outputText
  .replaceAll('"./api"', JSON.stringify(apiUrl))
  .replaceAll(
    '"./backend-error"',
    JSON.stringify(dataUrl("export function backendErrorCode() { return 'test'; }")),
  )
  .replaceAll(
    '"./i18n"',
    JSON.stringify(dataUrl("export function t(key) { return key; }")),
  )
  .replaceAll(
    '"./pixel-value-display"',
    JSON.stringify(dataUrl(`
      export function resolvePixelValueDisplay() { return "raw"; }
      export function widestPixelValueText() { return "65535"; }
      export function pixelValueLines() { return ["0"]; }
    `)),
  )
  .replaceAll(
    '"./pixel-grid-rendering"',
    JSON.stringify(dataUrl(pixelGridSource)),
  );
const [{ PixelValueOverlay }, api] = await Promise.all([
  import(dataUrl(runnableSource)),
  import(apiUrl),
]);

test("disabling high-zoom values keeps the pixel grid without inspecting DN data", () => {
  let gridCells = 0;
  let valueLabels = 0;
  let strokeStyle = "";
  const context = {
    setTransform() {},
    clearRect() {},
    measureText() { return { width: 40 }; },
    strokeRect() { gridCells += 1; },
    strokeText() { valueLabels += 1; },
    fillText() { valueLabels += 1; },
    set strokeStyle(value) { strokeStyle = value; },
    get strokeStyle() { return strokeStyle; },
  };
  const canvas = {
    width: 800,
    height: 600,
    style: {},
    getContext() { return context; },
  };
  const overlay = new PixelValueOverlay(canvas, {
    onError() {},
    requestDraw() {},
  });
  overlay.setPreferences({
    enabled: false,
    gridColor: "#ff00aa",
    demosaicValues: "rgb",
  });
  overlay.draw({
    document: {
      generation: 1,
      descriptor: { width: 4, height: 4, bitDepth: 14 },
    },
    frame: 0,
    displayMode: "raw",
    processing: {
      demosaicAlgorithm: "bilinear",
      remosaic: { sameColorReconstruction: false },
    },
    transform: {
      zoom: 64,
      visibleImageRect() {
        return { x: 0, y: 0, width: 2, height: 2 };
      },
      imageToScreen({ x, y }) {
        return { x: x * 64, y: y * 64 };
      },
    },
    width: 800,
    height: 600,
  });

  assert.equal(gridCells, 4);
  assert.equal(strokeStyle, "#ff00aa38");
  assert.equal(valueLabels, 0);
  assert.equal(api.inspectionCalls.length, 0);
});
