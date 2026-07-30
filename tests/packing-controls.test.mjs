import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/packing-controls.ts", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const packingControls = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("fixed packing formats lock their defined bit depth and hide container options", () => {
  const expectations = [
    ["unpacked8", 8],
    ["mipiRaw10", 10],
    ["mipiRaw12", 12],
    ["mipiRaw14", 14],
  ];
  for (const [packing, bitDepth] of expectations) {
    assert.deepEqual(packingControls.packingControlState(packing, 16), {
      bitDepth,
      bitDepthLocked: true,
      endiannessVisible: false,
      bitAlignmentVisible: false,
    });
  }
});

test("Unpacked16 exposes byte order and only meaningful valid-bit positioning", () => {
  assert.deepEqual(packingControls.packingControlState("unpacked16", 12), {
    bitDepth: 12,
    bitDepthLocked: false,
    endiannessVisible: true,
    bitAlignmentVisible: true,
  });
  assert.deepEqual(packingControls.packingControlState("unpacked16", 16), {
    bitDepth: 16,
    bitDepthLocked: false,
    endiannessVisible: true,
    bitAlignmentVisible: false,
  });
});

test("image format controls follow packing-first order and update dependent rows", () => {
  assert.match(
    appSource,
    /selectField\("packing"[\s\S]*?selectField\("bitDepth"[\s\S]*?segmentedField\("endianness"[\s\S]*?segmentedField\("bitAlignment"/,
  );
  assert.match(appSource, /depth\.disabled = state\.bitDepthLocked/);
  assert.match(appSource, /get\("endianness-row"\)\.toggleAttribute\("hidden", !state\.endiannessVisible\)/);
  assert.match(appSource, /get\("bitAlignment-row"\)\.toggleAttribute\("hidden", !state\.bitAlignmentVisible\)/);
});
