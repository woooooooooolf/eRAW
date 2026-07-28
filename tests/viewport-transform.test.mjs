import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/viewport-transform.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { ViewportTransform } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("viewport resize preserves the image point at the visual center", () => {
  const transform = new ViewportTransform();
  transform.zoom = 3.25;
  transform.cameraX = -847.5;
  transform.cameraY = 126.25;

  const previousSize = { width: 1280, height: 720 };
  const nextSize = { width: 1920, height: 1080 };
  const centerImagePoint = transform.screenToImage({
    x: previousSize.width / 2,
    y: previousSize.height / 2,
  });

  transform.preserveViewportCenter(
    previousSize.width,
    previousSize.height,
    nextSize.width,
    nextSize.height,
  );

  assert.deepEqual(transform.imageToScreen(centerImagePoint), {
    x: nextSize.width / 2,
    y: nextSize.height / 2,
  });
  assert.equal(transform.zoom, 3.25);
});

test("returning to the previous viewport size restores the camera", () => {
  const transform = new ViewportTransform();
  transform.cameraX = -312.5;
  transform.cameraY = 48.75;
  const originalCamera = { x: transform.cameraX, y: transform.cameraY };

  transform.preserveViewportCenter(1456, 939, 1920, 1080);
  transform.preserveViewportCenter(1920, 1080, 1456, 939);

  assert.deepEqual(
    { x: transform.cameraX, y: transform.cameraY },
    originalCamera,
  );
});
