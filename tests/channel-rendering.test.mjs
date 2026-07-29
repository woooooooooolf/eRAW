import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/channel-rendering.ts", import.meta.url), "utf8");
const [appSource, viewportSource, styleSource] = await Promise.all([
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
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
  assert.match(appSource, /this\.viewport\.setChannelRendering\(this\.settings\.channelRendering\)/);
  assert.match(viewportSource, /setChannelRendering\(mode: ChannelRenderingMode\)/);
  assert.match(viewportSource, /gl\.uniform3f\(this\.channelTintLocation/);
});

test("the shader preserves pixels that are already colorized", () => {
  assert.match(viewportSource, /float spread =/);
  assert.match(viewportSource, /mix\(color\.rgb \* u_channel_tint, color\.rgb/);
});

test("RGB channel buttons are explicit children of the Demosaic control", () => {
  assert.match(
    appSource,
    /id="demosaic-group"[\s\S]*?data-mode="demosaic"[\s\S]*?data-mode="red"[\s\S]*?data-mode="green"[\s\S]*?data-mode="blue"/,
  );
  assert.doesNotMatch(appSource, /id="channel-mode"/);
  assert.doesNotMatch(appSource, /全部通道/);
  assert.match(appSource, /this\.get\("demosaic-group"\)\.toggleAttribute\("hidden", !color\)/);
  for (const mode of ["red", "green", "blue"]) {
    assert.ok(styleSource.includes(`.channel-modes button[data-mode="${mode}"].active`));
  }
});
