import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewportSource = await readFile(
  new URL("../src/viewport.ts", import.meta.url),
  "utf8",
);

function tileTexel({
  fragment,
  viewport,
  framebuffer,
  camera,
  zoom,
  rect,
  textureSize,
}) {
  const screen = {
    x: fragment.x * viewport.width / framebuffer.width,
    y: (framebuffer.height - fragment.y) * viewport.height / framebuffer.height,
  };
  const image = {
    x: (screen.x - camera.x) / zoom,
    y: (screen.y - camera.y) / zoom,
  };
  const sampleSpan = {
    x: rect.width / textureSize.width,
    y: rect.height / textureSize.height,
  };
  return {
    x: Math.floor((image.x - rect.x) / sampleSpan.x),
    y: Math.floor((image.y - rect.y) / sampleSpan.y),
  };
}

test("tile shader derives one global image coordinate from the framebuffer", () => {
  assert.match(viewportSource, /uniform vec2 u_framebuffer;/);
  assert.match(viewportSource, /gl_FragCoord\.x \* u_viewport\.x \/ u_framebuffer\.x/);
  assert.match(viewportSource, /\(u_framebuffer\.y - gl_FragCoord\.y\) \* u_viewport\.y \/ u_framebuffer\.y/);
  assert.match(viewportSource, /vec2 image_point = \(screen_point - u_camera\) \/ u_zoom;/);
  assert.doesNotMatch(viewportSource, /v_image_point/);
  assert.match(
    viewportSource,
    /gl\.uniform2f\(this\.framebufferLocation, this\.canvas\.width, this\.canvas\.height\)/,
  );
});

test("adjacent L0 tiles sample continuously at a 256-row boundary", () => {
  const common = {
    viewport: { width: 1217.5, height: 803.25 },
    framebuffer: { width: 2435, height: 1607 },
    camera: { x: -111.375, y: 17.625 },
    zoom: 0.75,
    textureSize: { width: 256, height: 256 },
  };
  const boundaryScreenY = common.camera.y + 256 * common.zoom;
  const upperFragment = {
    x: 1000.5,
    y: common.framebuffer.height
      - (boundaryScreenY - 0.25) * common.framebuffer.height / common.viewport.height,
  };
  const lowerFragment = {
    x: 1000.5,
    y: common.framebuffer.height
      - (boundaryScreenY + 0.25) * common.framebuffer.height / common.viewport.height,
  };

  const upper = tileTexel({
    ...common,
    fragment: upperFragment,
    rect: { x: 0, y: 0, width: 256, height: 256 },
  });
  const lower = tileTexel({
    ...common,
    fragment: lowerFragment,
    rect: { x: 0, y: 256, width: 256, height: 256 },
  });

  assert.equal(upper.y, 255);
  assert.equal(lower.y, 0);
});
