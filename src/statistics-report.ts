import { t } from "./i18n";
import type {
  AnalysisResult,
  ProfilePoint,
  StatisticalSummary,
} from "./types";

const REPORT_WIDTH = 1920;
const REPORT_HEIGHT = 1080;

function formatValue(value: number | null, digits = 3): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

function summaryRows(summary: StatisticalSummary): Array<[string, string]> {
  return [
    [t("statistics.expected"), formatValue(summary.expectedCount, 0)],
    [t("statistics.valid"), formatValue(summary.validCount, 0)],
    [t("statistics.missing"), formatValue(summary.missingCount, 0)],
    [t("statistics.minimumMaximumDn"), `${formatValue(summary.minimum, 0)} / ${formatValue(summary.maximum, 0)}`],
    [t("statistics.meanMedianDn"), `${formatValue(summary.mean)} / ${formatValue(summary.median, 0)}`],
    [t("statistics.varianceStdDev"), `${formatValue(summary.variance)} / ${formatValue(summary.standardDeviation)}`],
    [t("statistics.percentiles"), `${formatValue(summary.p1, 0)} / ${formatValue(summary.p5, 0)} / ${formatValue(summary.p95, 0)} / ${formatValue(summary.p99, 0)}`],
  ];
}

function chartFrame(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
): { x: number; y: number; width: number; height: number } {
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#d6e0e7";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(x, y, width, height, 10);
  context.fill();
  context.stroke();
  context.fillStyle = "#1d3545";
  context.font = "650 18px system-ui";
  context.fillText(title, x + 22, y + 30);
  const plot = { x: x + 58, y: y + 48, width: width - 82, height: height - 82 };
  context.strokeStyle = "#d6e0e7";
  context.strokeRect(plot.x, plot.y, plot.width, plot.height);
  return plot;
}

function drawHistogram(
  context: CanvasRenderingContext2D,
  result: AnalysisResult,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const plot = chartFrame(context, x, y, width, height, t("statistics.histogram"));
  const histogram = result.groups.find((group) => group.key === "all")?.histogram
    ?? result.groups[0].histogram;
  const columns = Math.max(1, Math.floor(plot.width));
  const values = new Array<number>(columns).fill(0);
  histogram.forEach((count, index) => {
    const column = Math.min(columns - 1, Math.floor(index / histogram.length * columns));
    values[column] += count;
  });
  const maximum = Math.max(1, ...values);
  context.beginPath();
  values.forEach((count, index) => {
    const px = plot.x + index / Math.max(1, values.length - 1) * plot.width;
    const py = plot.y + plot.height - count / maximum * plot.height;
    if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
  });
  context.strokeStyle = "#2a9fc8";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#647786";
  context.font = "11px ui-monospace, monospace";
  context.fillText("DN 0", plot.x, plot.y + plot.height + 19);
  context.textAlign = "right";
  context.fillText(`DN ${2 ** result.snapshot.bitDepth - 1}`, plot.x + plot.width, plot.y + plot.height + 19);
  context.textAlign = "left";
}

function drawProfile(
  context: CanvasRenderingContext2D,
  points: ProfilePoint[],
  title: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const plot = chartFrame(context, x, y, width, height, title);
  const values = points.flatMap((point) => point.mean === null
    ? []
    : [{ coordinate: point.coordinate, value: point.mean }]);
  if (!values.length) return;
  const minX = values[0].coordinate;
  const maxX = values[values.length - 1].coordinate;
  const minY = Math.min(...values.map((point) => point.value));
  const maxY = Math.max(...values.map((point) => point.value));
  context.beginPath();
  values.forEach((point, index) => {
    const px = plot.x + (point.coordinate - minX) / Math.max(1, maxX - minX) * plot.width;
    const py = plot.y + plot.height - (point.value - minY) / Math.max(1e-9, maxY - minY) * plot.height;
    if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
  });
  context.strokeStyle = "#2a9fc8";
  context.lineWidth = 1.5;
  context.stroke();
  context.fillStyle = "#647786";
  context.font = "11px ui-monospace, monospace";
  context.fillText(formatValue(minY), plot.x + 5, plot.y + plot.height - 6);
  context.fillText(formatValue(maxY), plot.x + 5, plot.y + 15);
}

/**
 * 保留独立于界面主题的结构化 PNG 报告绘制能力。
 * 当前版本不提供入口，待报告版式重新确认后再接入保存流程。
 */
export function renderStatisticsReport(
  result: AnalysisResult,
  documentName: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = REPORT_WIDTH;
  canvas.height = REPORT_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(t("statistics.canvasUnavailable"));
  context.fillStyle = "#f7fafc";
  context.fillRect(0, 0, REPORT_WIDTH, REPORT_HEIGHT);
  context.fillStyle = "#112635";
  context.font = "700 34px system-ui";
  context.fillText(t("statistics.reportTitle"), 64, 68);
  const roi = result.snapshot.roi;
  context.fillStyle = "#607381";
  context.font = "16px system-ui";
  context.fillText(
    `${documentName} · ${t("statistics.frame")} ${result.snapshot.frame + 1} · ${result.snapshot.width}×${result.snapshot.height} · ${result.snapshot.packing} ${result.snapshot.bitDepth} ${t("statistics.bit")} · ${result.snapshot.cfa} · ROI X[${roi.x}, ${roi.x + roi.width - 1}] Y[${roi.y}, ${roi.y + roi.height - 1}]`,
    64,
    100,
  );

  const all = result.groups.find((group) => group.key === "all") ?? result.groups[0];
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#d6e0e7";
  context.beginPath();
  context.roundRect(64, 132, 420, 780, 10);
  context.fill();
  context.stroke();
  context.fillStyle = "#1d3545";
  context.font = "650 18px system-ui";
  context.fillText(t("statistics.allCfa"), 88, 170);
  summaryRows(all.summary).forEach(([label, value], index) => {
    const top = 212 + index * 74;
    context.fillStyle = "#718390";
    context.font = "13px system-ui";
    context.fillText(label, 88, top);
    context.fillStyle = "#173041";
    context.font = "600 16px ui-monospace, monospace";
    context.fillText(value, 88, top + 24);
  });

  drawHistogram(context, result, 516, 132, 1340, 405);
  drawProfile(context, all.rowProfile, t("statistics.rowProfile"), 516, 567, 650, 345);
  drawProfile(context, all.columnProfile, t("statistics.columnProfile"), 1206, 567, 650, 345);
  context.fillStyle = "#6d7e8a";
  context.font = "13px system-ui";
  context.fillText(t("statistics.disclaimer"), 64, 1018);
  return canvas;
}
