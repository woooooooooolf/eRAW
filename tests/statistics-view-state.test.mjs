import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/statistics-view-state.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
  key: (index) => [...values.keys()][index] ?? null,
  get length() { return values.size; },
};

const stateModule = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test.beforeEach(() => values.clear());

test("statistics view defaults keep charts and presentation heights independent", () => {
  const state = stateModule.defaultStatisticsViewState();
  assert.deepEqual(state.charts.histogram, { visibleGroups: null, xRange: null, yRange: null });
  assert.notEqual(state.charts.histogram, state.charts.row);
  assert.equal(state.heights.bottom.histogram, 280);
  assert.equal(state.heights.side.row, 310);
  assert.equal(state.heights.detached.column, 330);
});

test("automatic ranges clamp to the domain and collapse a full-domain range to auto", () => {
  assert.deepEqual(
    stateModule.normalizeStatisticsRange({ start: -20, end: 80 }, 0, 100),
    { start: 0, end: 80 },
  );
  assert.equal(stateModule.normalizeStatisticsRange({ start: -20, end: 120 }, 0, 100), null);
  assert.equal(stateModule.normalizeStatisticsRange({ start: 50, end: 50 }, 0, 100), null);
});

test("manual range edits reset the opposite endpoint after crossing it", () => {
  assert.deepEqual(
    stateModule.normalizeManualStatisticsRange("start", 80, { start: 10, end: 40 }, 0, 100),
    { start: 80, end: 100 },
  );
  assert.deepEqual(
    stateModule.normalizeManualStatisticsRange("end", 20, { start: 60, end: 90 }, 0, 100),
    { start: 0, end: 20 },
  );
});

test("persisted statistics view state is sanitized and reset only affects the active layout", () => {
  localStorage.setItem("eraw.statisticsView.v1", JSON.stringify({
    charts: {
      histogram: {
        visibleGroups: ["all", "R", 4],
        xRange: { start: 4, end: 200 },
        yRange: { start: "bad", end: 10 },
      },
    },
    heights: {
      bottom: { histogram: 80 },
      side: { row: 1200 },
      detached: { column: 480 },
    },
  }));
  const state = stateModule.loadStatisticsViewState();
  assert.deepEqual(state.charts.histogram.visibleGroups, ["all", "R"]);
  assert.deepEqual(state.charts.histogram.xRange, { start: 4, end: 200 });
  assert.equal(state.charts.histogram.yRange, null);
  assert.equal(state.heights.bottom.histogram, 220);
  assert.equal(state.heights.side.row, 900);
  assert.equal(state.heights.detached.column, 480);

  state.charts.row.visibleGroups = ["B"];
  state.heights.bottom.row = 500;
  state.heights.side.row = 520;
  stateModule.resetStatisticsViewState(state, "bottom");
  assert.deepEqual(state.charts.row, { visibleGroups: null, xRange: null, yRange: null });
  assert.equal(state.heights.bottom.row, 280);
  assert.equal(state.heights.side.row, 520);

  stateModule.saveStatisticsViewState(state);
  assert.deepEqual(JSON.parse(localStorage.getItem("eraw.statisticsView.v1")), state);
});
