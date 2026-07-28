import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/channel-rendering.ts", import.meta.url), "utf8");
const [appSource, viewportSource] = await Promise.all([
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport.ts", import.meta.url), "utf8"),
]);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const channelRendering = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("color rendering tints reconstructed channel intensity", () => {
  assert.deepEqual(channelRendering.channelTint("red", "color"), [1, 0, 0]);
  assert.deepEqual(channelRendering.channelTint("green", "color"), [0, 1, 0]);
  assert.deepEqual(channelRendering.channelTint("blue", "color"), [0, 0, 1]);
});

test("grayscale rendering preserves intensity in every color component", () => {
  for (const mode of ["red", "green", "blue"]) {
    assert.deepEqual(channelRendering.channelTint(mode, "grayscale"), [1, 1, 1]);
  }
});

test("channel rendering preference does not tint other display modes", () => {
  for (const mode of ["raw", "bayer", "remosaic", "demosaic"]) {
    assert.deepEqual(channelRendering.channelTint(mode, "color"), [1, 1, 1]);
  }
});

test("the persisted preference is applied as a presentation-only viewport setting", () => {
  assert.match(appSource, /channelRendering: "color"/);
  assert.match(appSource, /\["color", "grayscale"\]\.includes\(value\.channelRendering/);
  assert.match(appSource, /this\.viewport\.setChannelRendering\(this\.settings\.channelRendering\)/);
  assert.match(viewportSource, /setChannelRendering\(mode: ChannelRenderingMode\)/);
  assert.match(viewportSource, /gl\.uniform3f\(this\.channelTintLocation/);
});

test("the shader preserves non-grayscale diagnostic pixels", () => {
  assert.match(viewportSource, /float spread =/);
  assert.match(viewportSource, /mix\(color\.rgb \* u_channel_tint, color\.rgb/);
});
