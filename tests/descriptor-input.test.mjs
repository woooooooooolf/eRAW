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
