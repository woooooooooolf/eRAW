import type { GroupStatistics, ProfilePoint } from "./types";
import type { StatisticsAxisRange } from "./statistics-view-state";

export const MAX_PROFILE_RENDER_POINTS = 4_096;

type ProfileMetric = "mean" | "standardDeviation";

export interface HistogramDatum {
  value: [number, number];
  dnStart: number;
  dnEnd: number;
}

export function histogramSeriesData(histogram: readonly number[], maximumPoints = 4_096): HistogramDatum[] {
  if (!histogram.length) return [];
  const bucketSize = Math.max(1, Math.ceil(histogram.length / maximumPoints));
  const data: HistogramDatum[] = [];
  for (let start = 0; start < histogram.length; start += bucketSize) {
    const end = Math.min(histogram.length - 1, start + bucketSize - 1);
    let count = 0;
    for (let index = start; index <= end; index += 1) count += histogram[index];
    data.push({ value: [(start + end) / 2, count], dnStart: start, dnEnd: end });
  }
  return data;
}

export function maximumHistogramDisplayCount(series: readonly (readonly HistogramDatum[])[]): number {
  let maximum = 1;
  for (const data of series) {
    for (const datum of data) maximum = Math.max(maximum, datum.value[1]);
  }
  return maximum;
}

export function profileValueDomain(
  groups: readonly GroupStatistics[],
  profile: "rowProfile" | "columnProfile",
  metric: ProfileMetric = "mean",
): StatisticsAxisRange {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const group of groups) {
    for (const point of group[profile]) {
      const value = point[metric];
      if (value === null || !Number.isFinite(value)) continue;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return { start: 0, end: 1 };
  if (minimum === maximum) return { start: Math.max(0, minimum - 1), end: maximum + 1 };
  const padding = Math.max(0.5, (maximum - minimum) * 0.04);
  return { start: Math.max(0, minimum - padding), end: maximum + padding };
}

function lowerBound(points: readonly ProfilePoint[], coordinate: number): number {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (points[middle].coordinate < coordinate) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBound(points: readonly ProfilePoint[], coordinate: number): number {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (points[middle].coordinate <= coordinate) low = middle + 1;
    else high = middle;
  }
  return low;
}

function appendDistinct(target: Array<[number, number]>, point: [number, number]): void {
  if (target[target.length - 1]?.[0] !== point[0]) target.push(point);
}

export function profileSeriesData(
  points: readonly ProfilePoint[],
  metric: ProfileMetric,
  range: StatisticsAxisRange,
  maximumPoints = MAX_PROFILE_RENDER_POINTS,
): Array<[number, number]> {
  const startIndex = lowerBound(points, range.start);
  const endIndex = upperBound(points, range.end);
  const values: Array<[number, number]> = [];
  for (let index = startIndex; index < endIndex; index += 1) {
    const point = points[index];
    const value = point[metric];
    if (value !== null && Number.isFinite(value)) values.push([point.coordinate, value]);
  }
  const limit = Math.max(4, Math.floor(maximumPoints));
  if (values.length <= limit) return values;

  const result: Array<[number, number]> = [values[0]];
  const interiorCount = values.length - 2;
  const bucketCount = Math.max(1, Math.floor((limit - 2) / 2));
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = 1 + Math.floor(bucket * interiorCount / bucketCount);
    const end = 1 + Math.floor((bucket + 1) * interiorCount / bucketCount);
    if (start >= end) continue;
    let minimum = values[start];
    let maximum = values[start];
    for (let index = start + 1; index < end; index += 1) {
      const point = values[index];
      if (point[1] < minimum[1]) minimum = point;
      if (point[1] > maximum[1]) maximum = point;
    }
    if (minimum[0] <= maximum[0]) {
      appendDistinct(result, minimum);
      appendDistinct(result, maximum);
    } else {
      appendDistinct(result, maximum);
      appendDistinct(result, minimum);
    }
  }
  appendDistinct(result, values[values.length - 1]);
  return result;
}
