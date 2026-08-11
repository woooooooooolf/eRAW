import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

function dataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

const [captureSource, appSource, apiSource, outputSource, capabilitySource, exportDialogSource, commandsSource] = await Promise.all([
  readFile(new URL("../src/image-capture.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/image-output.ts", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8"),
  readFile(new URL("../src/export-dialog.ts", import.meta.url), "utf8"),
  readFile(new URL("../src-tauri/src/commands.rs", import.meta.url), "utf8"),
]);
const { outputText } = ts.transpileModule(captureSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const runnableSource = outputText
  .replaceAll(
    '"./api"',
    JSON.stringify(dataUrl("export async function renderTile() { return new Uint8Array(); }")),
  )
  .replaceAll(
    '"./channel-rendering"',
    JSON.stringify(dataUrl(`
      export function channelTint(mode, rendering) {
        if (rendering === "grayscale") return [1, 1, 1];
        if (mode === "red") return [1, 0, 0];
        if (mode === "green") return [0, 1, 0];
        if (mode === "blue") return [0, 0, 1];
        return [1, 1, 1];
      }
    `)),
  )
  .replaceAll(
    '"./display-exposure"',
    JSON.stringify(dataUrl(`
      export function effectiveDemosaicDisplayExposure(mode, exposure) {
        return mode === "demosaic" ? Math.max(-8, Math.min(8, exposure)) : 0;
      }
    `)),
  )
  .replaceAll(
    '"./missing-pixel-rendering"',
    JSON.stringify(dataUrl(`
      export function normalizeMissingPixelColor(value) {
        return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
          ? value.toLowerCase()
          : "#808080";
      }
    `)),
  );
const capture = await import(dataUrl(runnableSource));

test("full preview selects the highest-resolution LOD whose long edge is at most 4096 px", () => {
  assert.deepEqual(capture.previewDimensions(1920, 1080), {
    level: 0,
    scale: 1,
    width: 1920,
    height: 1080,
  });
  assert.deepEqual(capture.previewDimensions(8192, 4096), {
    level: 1,
    scale: 2,
    width: 4096,
    height: 2048,
  });
  const huge = capture.previewDimensions(100000, 100000);
  assert.ok(Math.max(huge.width, huge.height) <= 4096);
  assert.equal(huge.level, 5);
});

test("preview presentation keeps global missing-pixel phase and only tints grayscale channel data", () => {
  const missing = { pattern: "darkCheckerboard", color: "#808080" };
  const tile = new Uint8Array(256 * 256 * 4);
  const edgeOffset = (255 * 4);
  tile.set([1, 1, 1, 254], edgeOffset);
  capture.applyPreviewPresentation(tile, 0, 0, "raw", "color", missing);
  const expectedAt255 = Math.floor(255 / 12) % 2 === 0 ? [73, 81, 92, 255] : [41, 47, 55, 255];
  assert.deepEqual([...tile.slice(edgeOffset, edgeOffset + 4)], expectedAt255);

  const nextTile = new Uint8Array(4);
  nextTile.set([1, 1, 1, 254]);
  capture.applyPreviewPresentation(nextTile, 1, 0, "raw", "color", missing);
  const expectedAt256 = Math.floor(256 / 12) % 2 === 0 ? [73, 81, 92, 255] : [41, 47, 55, 255];
  assert.deepEqual([...nextTile], expectedAt256);

  const colors = new Uint8Array([100, 100, 100, 255, 10, 20, 30, 255]);
  capture.applyPreviewPresentation(colors, 0, 0, "red", "color", missing);
  assert.deepEqual([...colors], [100, 0, 0, 255, 10, 20, 30, 255]);

  const exposed = new Uint8Array([64, 128, 200, 255]);
  capture.applyPreviewPresentation(exposed, 0, 0, "demosaic", "color", missing, 1);
  assert.deepEqual([...exposed], [128, 255, 255, 255]);

  const unchangedRaw = new Uint8Array([64, 64, 64, 255]);
  capture.applyPreviewPresentation(unchangedRaw, 0, 0, "raw", "color", missing, 4);
  assert.deepEqual([...unchangedRaw], [64, 64, 64, 255]);
});

test("native context menus are suppressed globally and the canvas menu exposes only four capture actions", () => {
  assert.match(appSource, /document\.addEventListener\("contextmenu", \(event\) => this\.onContextMenu\(event\)\)/);
  assert.match(appSource, /private onContextMenu\(event: MouseEvent\): void \{\s*event\.preventDefault\(\)/);
  assert.match(appSource, /target\.closest\("#viewport"\)/);
  assert.match(appSource, /!this\.document\?\.layout\.frameCount/);
  assert.match(appSource, /this\.viewport\.consumeContextMenuSuppression\(\)/);
  const actions = [...appSource.matchAll(/data-capture-kind="(current|preview)" data-capture-destination="(save|copy)"/g)]
    .map((match) => `${match[1]}:${match[2]}`);
  assert.deepEqual(actions, ["current:save", "current:copy", "preview:save", "preview:copy"]);
  assert.doesNotMatch(appSource, /发送标签页到你的设备/);
});

test("save and clipboard actions consume the same captured canvas", () => {
  assert.match(appSource, /const canvas = kind === "current"[\s\S]*?this\.viewport\.captureFullPreview\(\)/);
  assert.match(appSource, /saveCanvasPng\(canvas, path\)/);
  assert.match(appSource, /copyCanvasImage\(canvas\)/);
  assert.match(apiSource, /invoke\("save_png", \{ path, png \}\)/);
  assert.match(outputSource, /canvasToPngBlob\(canvas\)/);
  assert.match(outputSource, /Image\.new\(canvasRgba\(canvas\), canvas\.width, canvas\.height\)/);
  assert.ok(JSON.parse(capabilitySource).permissions.includes("clipboard-manager:allow-write-image"));
});

test("RAW export reports progress and supports cooperative cancellation", () => {
  assert.match(apiSource, /new Channel<ExportProgress>\(\)/);
  assert.match(apiSource, /invoke\("cancel_raw_export", \{ exportRevision \}\)/);
  assert.match(exportDialogSource, /id="export-progress"/);
  assert.match(exportDialogSource, /cancelRawExport\(this\.exportRevision\)/);
  assert.match(exportDialogSource, /progressElement\.value = percent/);
  assert.match(commandsSource, /Channel<ExportProgress>/);
  assert.match(commandsSource, /export_raw_cancellable/);
});
