import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/roi-selection.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { validateRoiCoordinates } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("inclusive ROI coordinates produce a one-pixel minimum rectangle", () => {
  assert.deepEqual(
    validateRoiCoordinates({ xStart: "4", xEnd: "4", yStart: "7", yEnd: "7" }, 12, 10),
    { ok: true, rect: { x: 4, y: 7, width: 1, height: 1 } },
  );
});

test("inclusive ROI coordinates preserve both endpoints", () => {
  assert.deepEqual(
    validateRoiCoordinates({ xStart: 2, xEnd: 8, yStart: 3, yEnd: 6 }, 20, 10),
    { ok: true, rect: { x: 2, y: 3, width: 7, height: 4 } },
  );
});

test("ROI coordinates reject non-integers, reversed ranges, and out-of-bounds values", () => {
  assert.deepEqual(
    validateRoiCoordinates({ xStart: "", xEnd: 8, yStart: 3, yEnd: 6 }, 20, 10),
    { ok: false, field: "xStart", reason: "integer" },
  );
  assert.deepEqual(
    validateRoiCoordinates({ xStart: "1.5", xEnd: 8, yStart: 3, yEnd: 6 }, 20, 10),
    { ok: false, field: "xStart", reason: "integer" },
  );
  assert.deepEqual(
    validateRoiCoordinates({ xStart: 8, xEnd: 2, yStart: 3, yEnd: 6 }, 20, 10),
    { ok: false, field: "xEnd", reason: "xOrder" },
  );
  assert.deepEqual(
    validateRoiCoordinates({ xStart: 2, xEnd: 8, yStart: 6, yEnd: 3 }, 20, 10),
    { ok: false, field: "yEnd", reason: "yOrder" },
  );
  assert.deepEqual(
    validateRoiCoordinates({ xStart: 2, xEnd: 20, yStart: 3, yEnd: 6 }, 20, 10),
    { ok: false, field: "xEnd", reason: "bounds" },
  );
});
