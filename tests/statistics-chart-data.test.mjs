import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/statistics-chart-data.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const chartData = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

function profilePoint(coordinate, mean) {
  return {
    coordinate,
    expectedCount: 1,
    validCount: mean === null ? 0 : 1,
    missingCount: mean === null ? 1 : 0,
    mean,
    standardDeviation: mean === null ? null : 0,
  };
}

test("16-bit color histograms stay bounded and derive the axis from rendered buckets", () => {
  const groups = Array.from({ length: 6 }, (_, groupIndex) => {
    const histogram = new Array(65_536).fill(0);
    for (let index = 65_520; index < 65_536; index += 1) histogram[index] = 1_000 + groupIndex;
    return { histogram };
  });
  const rendered = groups.map((group) => chartData.histogramSeriesData(group.histogram));
  assert.ok(rendered.every((series) => series.length <= 4_096));
  assert.equal(chartData.maximumHistogramDisplayCount(rendered), 16_080);
  assert.deepEqual(rendered[0].at(-1), {
    value: [65_527.5, 16_000],
    dnStart: 65_520,
    dnEnd: 65_535,
  });
});

test("large profile domains scan all groups without a call-stack boundary", () => {
  const points = Array.from({ length: 25_000 }, (_, coordinate) => profilePoint(coordinate, 500 + coordinate % 200));
  points[12_345] = profilePoint(12_345, 60_000);
  const groups = Array.from({ length: 6 }, () => ({ rowProfile: points, columnProfile: points }));
  assert.deepEqual(chartData.profileValueDomain(groups, "columnProfile"), {
    start: 0,
    end: 62_380,
  });
});

test("full-resolution profiles use a bounded min-max envelope and preserve spikes", () => {
  const points = Array.from({ length: 25_000 }, (_, coordinate) => profilePoint(coordinate, 1_000 + coordinate % 50));
  points[5_432] = profilePoint(5_432, 500);
  points[12_345] = profilePoint(12_345, 60_000);
  const data = chartData.profileSeriesData(points, "mean", { start: 0, end: 24_999 });
  assert.ok(data.length <= chartData.MAX_PROFILE_RENDER_POINTS);
  assert.deepEqual(data[0], [0, 1_000]);
  assert.deepEqual(data.at(-1), [24_999, 1_049]);
  assert.ok(data.some(([coordinate, value]) => coordinate === 5_432 && value === 500));
  assert.ok(data.some(([coordinate, value]) => coordinate === 12_345 && value === 60_000));
});

test("zoomed profile ranges recover every visible source point when below the render limit", () => {
  const points = Array.from({ length: 25_000 }, (_, coordinate) => profilePoint(coordinate, coordinate));
  const data = chartData.profileSeriesData(points, "mean", { start: 12_000, end: 12_500 });
  assert.equal(data.length, 501);
  assert.deepEqual(data[0], [12_000, 12_000]);
  assert.deepEqual(data.at(-1), [12_500, 12_500]);
});
