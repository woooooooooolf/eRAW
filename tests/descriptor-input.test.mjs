import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/descriptor-input.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const descriptorInput = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("empty descriptor inputs normalize to their field minimum", () => {
  assert.equal(descriptorInput.normalizeIntegerInput("", 0), 0);
  assert.equal(descriptorInput.normalizeIntegerInput("", 1), 1);
});

test("descriptor inputs are truncated and clamped before display", () => {
  assert.equal(descriptorInput.normalizeIntegerInput("12.9", 0), 12);
  assert.equal(descriptorInput.normalizeIntegerInput("-4", 0), 0);
  assert.equal(descriptorInput.normalizeIntegerInput("9", 0, 3), 3);
  assert.equal(descriptorInput.normalizeIntegerInput("invalid", 1), 1);
});

const fallback = {
  width: 1920,
  height: 1080,
  bitDepth: 10,
  packing: "unpacked16",
  endianness: "little",
  bitAlignment: "lsb",
  cfa: "RGGB",
  cfaPhaseX: 0,
  cfaPhaseY: 0,
  rowAlignment: 1,
  rowStride: 0,
  frameAlignment: 1,
  frameStride: 0,
  headerOffset: 0,
};

test("persisted RAW descriptors validate every enum and numeric field", () => {
  const parsed = descriptorInput.parseRawDescriptor({
    width: "25000",
    height: Number.NaN,
    bitDepth: 99,
    packing: "unknown",
    endianness: "middle",
    bitAlignment: null,
    cfa: "INVALID",
    cfaPhaseX: -4,
    cfaPhaseY: 9,
    rowAlignment: 0,
    rowStride: -1,
    frameAlignment: 0,
    frameStride: Number.MAX_SAFE_INTEGER + 1,
    headerOffset: -1,
  }, fallback);
  assert.deepEqual(parsed, {
    ...fallback,
    bitDepth: 16,
    cfaPhaseX: 0,
    cfaPhaseY: 3,
    rowAlignment: 1,
    rowStride: 0,
    frameAlignment: 1,
    frameStride: 0,
    headerOffset: 0,
  });
});

test("persisted dimensions use the independent 25000 by 20000 limits", () => {
  assert.equal(descriptorInput.MAX_IMAGE_WIDTH, 25_000);
  assert.equal(descriptorInput.MAX_IMAGE_HEIGHT, 20_000);
  const parsed = descriptorInput.parseRawDescriptor({ width: 99_999, height: 99_999 }, fallback);
  assert.equal(parsed.width, 25_000);
  assert.equal(parsed.height, 20_000);
});
