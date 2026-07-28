import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/pixel-value-display.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const pixelValues = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("channel views select reconstructed values instead of the raw CFA sample", () => {
  const values = {
    raw: 16_383,
    red: 0,
    green: 8_192,
    blue: 4_096,
    rawValid: true,
    rgbValid: true,
  };

  assert.equal(pixelValues.resolvePixelValueDisplay("red", "rawDn"), "red");
  assert.equal(pixelValues.resolvePixelValueDisplay("green", "rawDn"), "green");
  assert.equal(pixelValues.resolvePixelValueDisplay("blue", "rawDn"), "blue");
  assert.deepEqual(pixelValues.pixelValueLines("red", values), ["R 0"]);
  assert.deepEqual(pixelValues.pixelValueLines("green", values), ["G 8192"]);
  assert.deepEqual(pixelValues.pixelValueLines("blue", values), ["B 4096"]);
});

test("raw and demosaic value preferences retain their existing semantics", () => {
  const values = {
    raw: 16_383,
    red: 0,
    green: 8_192,
    blue: 4_096,
    rawValid: true,
    rgbValid: true,
  };

  assert.equal(pixelValues.resolvePixelValueDisplay("bayer", "rgb"), "raw");
  assert.equal(pixelValues.resolvePixelValueDisplay("demosaic", "rawDn"), "raw");
  assert.equal(pixelValues.resolvePixelValueDisplay("demosaic", "rgb"), "rgb");
  assert.deepEqual(pixelValues.pixelValueLines("raw", values), ["16383"]);
  assert.deepEqual(pixelValues.pixelValueLines("rgb", values), [
    "R 0",
    "G 8192",
    "B 4096",
  ]);
});

test("invalid reconstructed values keep their channel identity", () => {
  const values = {
    raw: 0,
    red: 0,
    green: 0,
    blue: 0,
    rawValid: false,
    rgbValid: false,
  };

  assert.deepEqual(pixelValues.pixelValueLines("red", values), ["R —"]);
  assert.deepEqual(pixelValues.pixelValueLines("rgb", values), ["R —", "G —", "B —"]);
});
