import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [source, transformSource] = await Promise.all([
  readFile(new URL("../src/roi-selection.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport-transform.ts", import.meta.url), "utf8"),
]);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { hasExceededRoiDragThreshold, validateRoiCoordinates } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const { outputText: transformOutput } = ts.transpileModule(transformSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { SelectionModel } = await import(
  `data:text/javascript;base64,${Buffer.from(transformOutput).toString("base64")}`
);

test("right-button ROI gesture starts only after the drag threshold", () => {
  assert.equal(hasExceededRoiDragThreshold({ x: 10, y: 10 }, { x: 13, y: 12 }), false);
  assert.equal(hasExceededRoiDragThreshold({ x: 10, y: 10 }, { x: 14, y: 10 }), true);
});

test("mouse ROI coordinates clamp exterior canvas points to image edges", () => {
  const selection = new SelectionModel();
  selection.begin({ x: -12, y: -3 }, 20, 10);
  selection.update({ x: 24, y: 16 }, 20, 10);
  assert.deepEqual(selection.rect, { x: 0, y: 0, width: 20, height: 10 });
});

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
