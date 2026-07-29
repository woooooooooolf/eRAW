import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const transformSource = await readFile(
  new URL("../src/viewport-transform.ts", import.meta.url),
  "utf8",
);
const viewportSource = await readFile(
  new URL("../src/viewport.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(transformSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { snapCoordinateToPhysicalPixels } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("actual-size camera coordinates align to physical pixels at common DPRs", () => {
  const viewportWidth = 2279;
  const viewportHeight = 1287;
  const imageWidth = 1920;
  const imageHeight = 1080;

  for (const dpr of [1, 1.25, 1.5, 2]) {
    const framebufferWidth = Math.round(viewportWidth * dpr);
    const framebufferHeight = Math.round(viewportHeight * dpr);
    const cameraX = (viewportWidth - imageWidth) / 2;
    const cameraY = (viewportHeight - imageHeight) / 2;
    const alignedX = snapCoordinateToPhysicalPixels(
      cameraX,
      viewportWidth,
      framebufferWidth,
    );
    const alignedY = snapCoordinateToPhysicalPixels(
      cameraY,
      viewportHeight,
      framebufferHeight,
    );
    const scaleX = framebufferWidth / viewportWidth;
    const scaleY = framebufferHeight / viewportHeight;

    assert.ok(Math.abs(alignedX * scaleX - Math.round(alignedX * scaleX)) < 1e-9);
    assert.ok(Math.abs(alignedY * scaleY - Math.round(alignedY * scaleY)) < 1e-9);
    assert.ok(Math.abs(alignedX - cameraX) * scaleX <= 0.5 + 1e-9);
    assert.ok(Math.abs(alignedY - cameraY) * scaleY <= 0.5 + 1e-9);
  }
});

test("fit and resize paths align the camera whenever zoom is exactly 100 percent", () => {
  assert.match(
    viewportSource,
    /fit\(\): void \{[\s\S]*?this\.cameraY =[\s\S]*?this\.alignCameraAtActualSize\(\);/,
  );
  assert.match(
    viewportSource,
    /private resize\(\): void \{[\s\S]*?this\.canvas\.height = pixelHeight;[\s\S]*?this\.alignCameraAtActualSize\(\);/,
  );
  assert.match(
    viewportSource,
    /private alignCameraAtActualSize\(\): void \{[\s\S]*?Math\.abs\(this\.zoom - 1\)[\s\S]*?this\.snapCameraToPhysicalPixels\(\);/,
  );
});

test("the reverted shader uses tile image coordinates instead of framebuffer reconstruction", () => {
  assert.match(viewportSource, /out vec2 v_image_point;/);
  assert.match(viewportSource, /in vec2 v_image_point;/);
  assert.doesNotMatch(viewportSource, /gl_FragCoord/);
  assert.doesNotMatch(viewportSource, /u_framebuffer/);
});
