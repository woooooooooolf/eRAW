import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import * as echarts from "echarts";

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

test("profile range equality ignores resize noise but detects a real zoom", () => {
  const current = { start: 0, end: 24_999 };
  assert.equal(chartData.statisticsAxisRangesEqual(current, { start: 0, end: 24_999.000001 }), true);
  assert.equal(chartData.statisticsAxisRangesEqual(current, { start: 1, end: 24_999 }), false);
  assert.equal(chartData.statisticsAxisRangesEqual(undefined, current), false);
});

test("profile markers appear only when real samples are sparse enough on screen", () => {
  const dense = Array.from({ length: 501 }, (_, index) => [index * 2, index]);
  assert.equal(chartData.shouldShowProfileMarkers(dense, { start: 0, end: 1000 }, 800), false);
  const tooMany = Array.from({ length: 513 }, (_, index) => [index * 2, index]);
  assert.equal(chartData.shouldShowProfileMarkers(tooMany, { start: 0, end: 1024 }, 3200), false);

  const zoomed = Array.from({ length: 201 }, (_, index) => [index * 2, index]);
  assert.equal(chartData.shouldShowProfileMarkers(zoomed, { start: 0, end: 400 }, 1100), true);
  assert.equal(chartData.shouldShowProfileMarkers([[120, 10]], { start: 100, end: 140 }, 800), true);
  assert.equal(chartData.shouldShowProfileMarkers([], { start: 0, end: 400 }, 800), false);
});

test("actual ECharts keeps bounded profile extrema and histogram buckets across narrow widths and resize", () => {
  const points=Array.from({length:25000},(_,coordinate)=>profilePoint(coordinate,1000));
  points[900].mean=60000; points[990].mean=55000;
  const envelope=chartData.profileSeriesData(points,"mean",{start:0,end:24999});
  const histogram=chartData.histogramSeriesData(Array.from({length:65536},(_,i)=>i%19));
  for(const width of [280,400,1100]) {
    const chart=echarts.init(null,null,{renderer:"svg",ssr:true,width,height:300});
    try {
      for(const [data,domain] of [[envelope,24999],[histogram,65535]]) {
        chart.setOption({animation:false,grid:{left:62,right:54},xAxis:{type:"value",min:0,max:domain},yAxis:{type:"value"},
          series:Array.from({length:6},()=>({type:"line",data,sampling:chartData.STATISTICS_LINE_SAMPLING,showSymbol:false}))},{notMerge:true});
        chart.resize({width:width+20,height:320});
        for(let group=0;group<6;group++) {
          const actual=chart.getModel().getSeriesByIndex(group).getData();
          assert.equal(actual.count(),data.length);
          if(data===envelope) {
            const extrema=[];
            for(let i=0;i<actual.count();i++)if(actual.get("y",i)>10000)extrema.push([actual.get("x",i),actual.get("y",i)]);
            assert.deepEqual(extrema,[[900,60000],[990,55000]]);
          }
        }
      }
    } finally {chart.dispose();}
  }
  const source=readFile(new URL("../src/statistics-chart.ts",import.meta.url),"utf8");
  return source.then(text=>assert.equal((text.match(/sampling: STATISTICS_LINE_SAMPLING/g)??[]).length,2));
});
