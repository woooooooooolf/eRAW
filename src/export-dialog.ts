import { chooseExportFile, exportDocument } from "./api";
import type {
  BitAlignment,
  CfaPattern,
  DocumentInfo,
  Endianness,
  ExportRequest,
  ExportResult,
  MissingPixelCounts,
  Packing,
  RawDescriptor,
  ValueMapping,
} from "./types";

type RangeMode = "size" | "end";
type MessageKind = "error" | "warning" | "info";

interface ExportSnapshot {
  path: string;
  name: string;
  generation: number;
  descriptor: RawDescriptor;
  frame: number;
  partial: boolean;
}

interface ExportDialogCallbacks {
  onSuccess(message: string): void;
}

const RANGE_IDS = ["crop-x", "crop-y", "crop-width", "crop-height", "crop-end-x", "crop-end-y"] as const;
const FILL_IDS = ["fill-mono", "fill-red", "fill-green-blue", "fill-green-red", "fill-blue"] as const;

function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let size = Math.max(0, value);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 100 || unit === 0 ? size.toFixed(0) : size.toFixed(2)} ${units[unit]}`;
}

function exportNumber(id: string, label: string, min: number, unit = "px"): string {
  return `<label class="export-field" data-export-field="${id}">
    <span>${label}</span>
    <div class="number-input"><input id="${id}" type="number" min="${min}" step="1"/><b>${unit}</b></div>
    <small class="export-field-error" aria-live="polite"></small>
  </label>`;
}

function exportSelect(id: string, label: string, options: string): string {
  return `<label class="export-field" data-export-field="${id}">
    <span>${label}</span>
    <select id="${id}">${options}</select>
    <small class="export-field-error" aria-live="polite"></small>
  </label>`;
}

export function exportDialogTemplate(): string {
  return `<dialog id="export-dialog" class="modal export-modal">
    <form id="export-form" novalidate>
      <header>
        <div><small>DETERMINISTIC CONVERSION</small><h2>导出 RAW 数据</h2></div>
        <button id="close-export" type="button" class="dialog-close" aria-label="关闭">×</button>
      </header>
      <div class="dialog-body">
        <div id="export-message" class="export-message" role="alert" hidden></div>
        <div class="export-source">
          <div><span>来源快照</span><strong id="export-source-name">—</strong></div>
          <p id="export-source-summary">—</p>
        </div>

        <section>
          <div class="export-section-heading">
            <h3>有效区域</h3>
            <div id="export-range-mode" class="export-mode-switch" role="group" aria-label="范围输入方式">
              <button type="button" class="active" data-range-mode="size">起点 + 宽高</button>
              <button type="button" data-range-mode="end">起点 + 结束坐标</button>
            </div>
          </div>
          <div class="export-grid export-range-grid">
            ${exportNumber("crop-x", "起点 X", 0)}
            ${exportNumber("crop-y", "起点 Y", 0)}
            <div id="export-size-fields" class="export-range-fields">
              ${exportNumber("crop-width", "宽度", 1)}
              ${exportNumber("crop-height", "高度", 1)}
            </div>
            <div id="export-end-fields" class="export-range-fields" hidden>
              ${exportNumber("crop-end-x", "结束 X（包含）", 0)}
              ${exportNumber("crop-end-y", "结束 Y（包含）", 0)}
            </div>
          </div>
          <div class="phase-note">
            输出 CFA：<strong id="export-cfa">—</strong>
            <span id="export-range-summary">—</span>
          </div>
        </section>

        <section>
          <h3>输出编码</h3>
          <div class="export-grid">
            ${exportSelect("export-packing", "存储方式", `<option value="unpacked8">Unpacked 8</option><option value="unpacked16">Unpacked 16</option><option value="mipiRaw10">MIPI RAW10</option><option value="mipiRaw12">MIPI RAW12</option><option value="mipiRaw14">MIPI RAW14</option>`)}
            ${exportSelect("export-depth", "位深", `<option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option>`)}
            ${exportSelect("export-endian", "字节序", `<option value="little">Little endian</option><option value="big">Big endian</option>`)}
            ${exportSelect("export-bit-alignment", "有效位位置", `<option value="lsb">容器低位 LSB</option><option value="msb">容器高位 MSB</option>`)}
            ${exportNumber("export-row-alignment", "行对齐", 1, "B")}
            ${exportNumber("export-frame-alignment", "帧对齐", 1, "B")}
            ${exportSelect("export-mapping", "像素值映射", `<option value="preserve">保持数值，超限裁剪</option><option value="scaleFullRange">按满量程缩放</option>`)}
          </div>
        </section>

        <section>
          <div class="export-section-heading">
            <h3>缺失像素填充</h3>
            <span id="export-fill-format">—</span>
          </div>
          <p class="export-fill-help">填充值属于最终输出 DN，不参与保持数值或满量程缩放。</p>
          <div id="export-mono-fill" class="export-grid export-fill-grid">
            ${exportNumber("fill-mono", "MONO 输出 DN", 0, "DN")}
          </div>
          <div id="export-bayer-fill" class="export-grid export-fill-grid" hidden>
            ${exportNumber("fill-red", "R", 0, "DN")}
            ${exportNumber("fill-green-blue", "Gb（蓝行绿）", 0, "DN")}
            ${exportNumber("fill-green-red", "Gr（红行绿）", 0, "DN")}
            ${exportNumber("fill-blue", "B", 0, "DN")}
          </div>
        </section>
      </div>
      <footer>
        <p id="export-summary">仅导出来源快照中的当前帧。</p>
        <div>
          <button id="cancel-export" type="button" class="secondary-button">取消</button>
          <button id="confirm-export" type="submit" class="primary-button">选择位置并导出</button>
        </div>
      </footer>
    </form>
  </dialog>`;
}

export class ExportDialog {
  private readonly root: HTMLElement;
  private readonly callbacks: ExportDialogCallbacks;
  private snapshot: ExportSnapshot | null = null;
  private rangeMode: RangeMode = "size";
  private busy = false;

  constructor(root: HTMLElement, callbacks: ExportDialogCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.bindEvents();
  }

  get isOpen(): boolean {
    return this.get<HTMLDialogElement>("export-dialog").open;
  }

  open(document: DocumentInfo, frame: number): void {
    this.snapshot = {
      path: document.path,
      name: document.name,
      generation: document.generation,
      descriptor: { ...document.descriptor },
      frame,
      partial: frame >= document.layout.completeFrameCount,
    };
    this.rangeMode = "size";
    this.clearAllErrors();
    this.showMessage("", "info");
    this.setBusy(false);

    this.get("export-source-name").textContent = document.name;
    this.get("export-source-summary").textContent =
      `帧 ${frame + 1}/${document.layout.frameCount} · ${document.descriptor.width} × ${document.descriptor.height} · ${document.descriptor.bitDepth} bit · ${document.descriptor.packing} · ${document.descriptor.cfa}`;

    this.setValue("crop-x", 0);
    this.setValue("crop-y", 0);
    this.setValue("crop-width", document.descriptor.width);
    this.setValue("crop-height", document.descriptor.height);
    this.setValue("crop-end-x", document.descriptor.width - 1);
    this.setValue("crop-end-y", document.descriptor.height - 1);
    this.setRangeMode("size");

    this.get<HTMLSelectElement>("export-packing").value = document.descriptor.packing;
    this.get<HTMLSelectElement>("export-depth").value = String(document.descriptor.bitDepth);
    this.get<HTMLSelectElement>("export-endian").value = document.descriptor.endianness;
    this.get<HTMLSelectElement>("export-bit-alignment").value = document.descriptor.bitAlignment;
    this.get<HTMLSelectElement>("export-mapping").value = "preserve";
    this.setValue("export-row-alignment", 1);
    this.setValue("export-frame-alignment", 1);
    FILL_IDS.forEach((id) => this.setValue(id, 0));

    this.applyPackingRules();
    this.updateFillMode();
    this.normalizeAxis("x", "crop-x");
    this.normalizeAxis("y", "crop-y");
    this.updateOutputSummary();
    this.restoreSnapshotMessage();
    this.get<HTMLDialogElement>("export-dialog").showModal();
  }

  private get<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = this.root.querySelector<T>(`#${id}`);
    if (!element) throw new Error(`缺少导出界面元素 #${id}`);
    return element;
  }

  private bindEvents(): void {
    this.get("close-export").addEventListener("click", () => this.close());
    this.get("cancel-export").addEventListener("click", () => this.close());
    this.get<HTMLFormElement>("export-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void this.performExport();
    });
    this.get("export-range-mode").querySelectorAll<HTMLButtonElement>("[data-range-mode]").forEach((button) => {
      button.addEventListener("click", () => this.setRangeMode(button.dataset.rangeMode as RangeMode));
    });

    RANGE_IDS.forEach((id) => {
      const input = this.get<HTMLInputElement>(id);
      input.addEventListener("input", () => {
        this.restoreSnapshotMessage();
        this.clearFieldError(id);
        this.updateRangeSummary();
      });
      input.addEventListener("change", () => {
        const axis = id.endsWith("x") || id === "crop-width" ? "x" : "y";
        this.normalizeAxis(axis, id);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
    });

    this.get<HTMLSelectElement>("export-packing").addEventListener("change", () => {
      this.restoreSnapshotMessage();
      this.applyPackingRules();
      this.clampFillValues();
      this.updateOutputSummary();
    });
    this.get<HTMLSelectElement>("export-depth").addEventListener("change", () => {
      this.restoreSnapshotMessage();
      this.clampFillValues();
      this.updateOutputSummary();
    });
    ["export-row-alignment", "export-frame-alignment"].forEach((id) => {
      const input = this.get<HTMLInputElement>(id);
      input.addEventListener("input", () => {
        this.restoreSnapshotMessage();
        this.clearFieldError(id);
        this.updateOutputSummary();
      });
      input.addEventListener("change", () => this.clampIntegerField(id, 1, Number.MAX_SAFE_INTEGER));
    });
    FILL_IDS.forEach((id) => {
      const input = this.get<HTMLInputElement>(id);
      input.addEventListener("input", () => {
        this.restoreSnapshotMessage();
        this.clearFieldError(id);
      });
      input.addEventListener("change", () => this.clampFillField(id));
    });
  }

  private close(): void {
    if (!this.busy) this.get<HTMLDialogElement>("export-dialog").close();
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.get<HTMLButtonElement>("confirm-export").disabled = busy;
    this.get<HTMLButtonElement>("cancel-export").disabled = busy;
    this.get<HTMLButtonElement>("close-export").disabled = busy;
    this.get<HTMLButtonElement>("confirm-export").textContent = busy ? "正在导出…" : "选择位置并导出";
  }

  private setRangeMode(mode: RangeMode): void {
    if (!this.snapshot) return;
    if (mode !== this.rangeMode) {
      if (mode === "end") {
        this.syncEndFromSize();
      } else {
        this.syncSizeFromEnd();
      }
    }
    this.rangeMode = mode;
    this.get("export-size-fields").toggleAttribute("hidden", mode !== "size");
    this.get("export-end-fields").toggleAttribute("hidden", mode !== "end");
    this.get("export-range-mode").querySelectorAll<HTMLButtonElement>("[data-range-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.rangeMode === mode);
      button.setAttribute("aria-pressed", String(button.dataset.rangeMode === mode));
    });
    this.normalizeAxis("x", "crop-x");
    this.normalizeAxis("y", "crop-y");
  }

  private normalizeAxis(axis: "x" | "y", changedId: string): void {
    if (!this.snapshot) return;
    const limit = axis === "x" ? this.snapshot.descriptor.width : this.snapshot.descriptor.height;
    const startId = axis === "x" ? "crop-x" : "crop-y";
    const sizeId = axis === "x" ? "crop-width" : "crop-height";
    const endId = axis === "x" ? "crop-end-x" : "crop-end-y";
    let start = this.integerValue(startId);
    if (start === null) {
      this.setFieldError(startId, "请输入整数坐标");
      return;
    }

    if (this.rangeMode === "size") {
      let size = this.integerValue(sizeId);
      if (size === null) {
        this.setFieldError(sizeId, "请输入大于 0 的整数");
        return;
      }
      if (changedId === sizeId) {
        size = this.clamp(size, 1, limit);
        start = this.clamp(start, 0, limit - size);
      } else {
        start = this.clamp(start, 0, limit - 1);
        size = this.clamp(size, 1, limit - start);
      }
      this.setValue(startId, start);
      this.setValue(sizeId, size);
      this.setValue(endId, start + size - 1);
    } else {
      let end = this.integerValue(endId);
      if (end === null) {
        this.setFieldError(endId, "请输入整数坐标");
        return;
      }
      if (changedId === endId) {
        end = this.clamp(end, 0, limit - 1);
        start = this.clamp(start, 0, end);
      } else {
        start = this.clamp(start, 0, limit - 1);
        end = this.clamp(end, start, limit - 1);
      }
      this.setValue(startId, start);
      this.setValue(endId, end);
      this.setValue(sizeId, end - start + 1);
    }

    const size = this.value(sizeId);
    const end = this.value(endId);
    this.get<HTMLInputElement>(startId).max = String(this.rangeMode === "size" ? limit - size : end);
    this.get<HTMLInputElement>(sizeId).max = String(limit - this.value(startId));
    this.get<HTMLInputElement>(endId).min = String(this.value(startId));
    this.get<HTMLInputElement>(endId).max = String(limit - 1);
    this.clearFieldError(startId);
    this.clearFieldError(sizeId);
    this.clearFieldError(endId);
    this.updateRangeSummary();
    this.updateOutputSummary();
  }

  private syncEndFromSize(): void {
    const x = this.value("crop-x");
    const y = this.value("crop-y");
    this.setValue("crop-end-x", x + Math.max(1, this.value("crop-width")) - 1);
    this.setValue("crop-end-y", y + Math.max(1, this.value("crop-height")) - 1);
  }

  private syncSizeFromEnd(): void {
    const x = this.value("crop-x");
    const y = this.value("crop-y");
    this.setValue("crop-width", Math.max(1, this.value("crop-end-x") - x + 1));
    this.setValue("crop-height", Math.max(1, this.value("crop-end-y") - y + 1));
  }

  private updateRangeSummary(): void {
    if (!this.snapshot) return;
    const x = this.integerValue("crop-x");
    const y = this.integerValue("crop-y");
    const width = this.integerValue("crop-width");
    const height = this.integerValue("crop-height");
    if ([x, y, width, height].some((value) => value === null)) {
      this.get("export-range-summary").textContent = "范围尚未完成";
      return;
    }
    this.get("export-cfa").textContent = this.shiftedCfa(this.snapshot.descriptor.cfa, x!, y!);
    this.get("export-range-summary").textContent =
      `(${x}, ${y}) → (${x! + width! - 1}, ${y! + height! - 1}) · ${width} × ${height}`;
  }

  private applyPackingRules(): void {
    const packing = this.get<HTMLSelectElement>("export-packing").value as Packing;
    const depth = this.get<HTMLSelectElement>("export-depth");
    const fixedDepth: Partial<Record<Packing, number>> = {
      unpacked8: 8,
      mipiRaw10: 10,
      mipiRaw12: 12,
      mipiRaw14: 14,
    };
    if (fixedDepth[packing] !== undefined) depth.value = String(fixedDepth[packing]);
    depth.disabled = packing !== "unpacked16";
    const containerOptionsApply = packing === "unpacked16";
    this.get<HTMLSelectElement>("export-endian").disabled = !containerOptionsApply;
    this.get<HTMLSelectElement>("export-bit-alignment").disabled = !containerOptionsApply;
  }

  private updateFillMode(): void {
    if (!this.snapshot) return;
    const mono = this.snapshot.descriptor.cfa === "MONO";
    this.get("export-mono-fill").toggleAttribute("hidden", !mono);
    this.get("export-bayer-fill").toggleAttribute("hidden", mono);
    this.get("export-fill-format").textContent = mono
      ? "当前源格式：MONO"
      : `当前源格式：Bayer ${this.snapshot.descriptor.cfa}`;
    this.clampFillValues();
  }

  private clampFillValues(): void {
    const maximum = this.outputMaximum();
    FILL_IDS.forEach((id) => {
      this.get<HTMLInputElement>(id).max = String(maximum);
      this.clampFillField(id);
    });
  }

  private clampFillField(id: string): void {
    this.clampIntegerField(id, 0, this.outputMaximum());
  }

  private clampIntegerField(id: string, minimum: number, maximum: number): boolean {
    const value = this.integerValue(id);
    if (value === null) {
      this.setFieldError(id, "请输入整数");
      return false;
    }
    this.setValue(id, this.clamp(value, minimum, maximum));
    this.clearFieldError(id);
    this.updateOutputSummary();
    return true;
  }

  private outputMaximum(): number {
    const depth = Number(this.get<HTMLSelectElement>("export-depth").value);
    return depth >= 16 ? 65_535 : 2 ** depth - 1;
  }

  private validate(): boolean {
    if (!this.snapshot) return false;
    this.clearAllErrors();
    this.normalizeAxis("x", "crop-x");
    this.normalizeAxis("y", "crop-y");
    let valid = true;
    const activeRange = this.rangeMode === "size"
      ? ["crop-x", "crop-y", "crop-width", "crop-height"]
      : ["crop-x", "crop-y", "crop-end-x", "crop-end-y"];
    activeRange.forEach((id) => {
      if (this.integerValue(id) === null) {
        this.setFieldError(id, "请输入整数");
        valid = false;
      }
    });
    ["export-row-alignment", "export-frame-alignment"].forEach((id) => {
      const value = this.integerValue(id);
      if (value === null || value < 1 || !Number.isSafeInteger(value)) {
        this.setFieldError(id, "必须是大于 0 的安全整数");
        valid = false;
      }
    });
    const fillIds = this.snapshot.descriptor.cfa === "MONO"
      ? ["fill-mono"]
      : ["fill-red", "fill-green-blue", "fill-green-red", "fill-blue"];
    fillIds.forEach((id) => {
      const value = this.integerValue(id);
      if (value === null || value < 0 || value > this.outputMaximum()) {
        this.setFieldError(id, `请输入 0–${this.outputMaximum()} 之间的整数`);
        valid = false;
      }
    });
    if (!valid) {
      this.showMessage("请修正标红的导出参数后重试。", "error");
      this.root.querySelector<HTMLInputElement | HTMLSelectElement>(".export-field.invalid input, .export-field.invalid select")?.focus();
    }
    return valid;
  }

  private buildRequest(path: string): ExportRequest {
    const snapshot = this.snapshot!;
    return {
      path,
      sourcePath: snapshot.path,
      sourceGeneration: snapshot.generation,
      sourceDescriptor: { ...snapshot.descriptor },
      currentFrame: snapshot.frame,
      cropX: this.value("crop-x"),
      cropY: this.value("crop-y"),
      cropWidth: this.value("crop-width"),
      cropHeight: this.value("crop-height"),
      packing: this.get<HTMLSelectElement>("export-packing").value as Packing,
      bitDepth: Number(this.get<HTMLSelectElement>("export-depth").value),
      endianness: this.get<HTMLSelectElement>("export-endian").value as Endianness,
      bitAlignment: this.get<HTMLSelectElement>("export-bit-alignment").value as BitAlignment,
      rowAlignment: this.value("export-row-alignment"),
      frameAlignment: this.value("export-frame-alignment"),
      valueMapping: this.get<HTMLSelectElement>("export-mapping").value as ValueMapping,
      missingPixelFill: {
        mono: this.value("fill-mono"),
        red: this.value("fill-red"),
        greenBlue: this.value("fill-green-blue"),
        greenRed: this.value("fill-green-red"),
        blue: this.value("fill-blue"),
      },
    };
  }

  private async performExport(): Promise<void> {
    if (this.busy || !this.snapshot || !this.validate()) return;
    const defaultPath = this.snapshot.path.replace(/(?:\.[^\\/.]+)?$/, "_extracted.raw");
    try {
      const path = await chooseExportFile(defaultPath);
      if (!path) return;
      this.setBusy(true);
      this.showMessage("正在转换并安全写入 RAW 数据…", "info");
      const result = await exportDocument(this.buildRequest(path));
      this.get<HTMLDialogElement>("export-dialog").close();
      this.callbacks.onSuccess(this.successMessage(result));
    } catch (error) {
      const normalized = this.normalizeError(error);
      if (normalized.field) this.setFieldError(this.fieldId(normalized.field), normalized.message);
      this.showMessage(normalized.message, "error");
    } finally {
      this.setBusy(false);
    }
  }

  private successMessage(result: ExportResult): string {
    const filled = this.totalFilled(result.filledPixels);
    const clipped = result.clippedValues ? ` · 裁剪 ${result.clippedValues} 像素` : "";
    const missing = filled ? ` · 填充 ${filled} 像素` : "";
    return `已导出当前帧 · ${formatBytes(result.bytesWritten)} · ${result.outputCfa}${missing}${clipped}`;
  }

  private totalFilled(counts: MissingPixelCounts): number {
    return counts.mono + counts.red + counts.greenBlue + counts.greenRed + counts.blue;
  }

  private normalizeError(error: unknown): { field?: string; message: string } {
    if (typeof error === "object" && error !== null) {
      const value = error as { field?: unknown; message?: unknown };
      if (typeof value.message === "string") {
        return {
          field: typeof value.field === "string" ? value.field : undefined,
          message: value.message,
        };
      }
    }
    return { message: String(error).replace(/^Error:\s*/, "").trim() || "导出失败" };
  }

  private fieldId(field: string): string {
    const fields: Record<string, string> = {
      cropX: "crop-x",
      cropY: "crop-y",
      cropWidth: "crop-width",
      cropHeight: "crop-height",
      bitDepth: "export-depth",
      rowAlignment: "export-row-alignment",
      frameAlignment: "export-frame-alignment",
      missingPixelFill: this.snapshot?.descriptor.cfa === "MONO" ? "fill-mono" : "fill-red",
    };
    return fields[field] ?? field;
  }

  private showMessage(message: string, kind: MessageKind): void {
    const element = this.get("export-message");
    element.textContent = message;
    element.className = `export-message ${kind}`;
    element.toggleAttribute("hidden", !message);
  }

  private restoreSnapshotMessage(): void {
    if (this.snapshot?.partial) {
      this.showMessage("当前来源帧不完整；读取不到的像素将使用下方按通道设置的输出 DN。", "warning");
    } else {
      this.showMessage("", "info");
    }
  }

  private updateOutputSummary(): void {
    const width = this.integerValue("crop-width");
    const height = this.integerValue("crop-height");
    const rowAlignment = this.integerValue("export-row-alignment");
    const frameAlignment = this.integerValue("export-frame-alignment");
    if (width === null || height === null || rowAlignment === null || frameAlignment === null || rowAlignment < 1 || frameAlignment < 1) {
      this.get("export-summary").textContent = "完成参数后显示预计输出大小。";
      return;
    }
    const packing = this.get<HTMLSelectElement>("export-packing").value as Packing;
    const packedRow = packing === "unpacked8"
      ? width
      : packing === "unpacked16"
        ? width * 2
        : packing === "mipiRaw10"
          ? Math.ceil(width / 4) * 5
          : packing === "mipiRaw12"
            ? Math.ceil(width / 2) * 3
            : Math.ceil(width / 4) * 7;
    const rowStride = this.alignUp(packedRow, rowAlignment);
    const bytes = this.alignUp(rowStride * height, frameAlignment);
    this.get("export-summary").textContent =
      Number.isSafeInteger(bytes)
        ? `仅导出当前帧 · 行步长 ${formatBytes(rowStride)} · 预计 ${formatBytes(bytes)}`
        : "输出大小超过安全计算范围，请减小尺寸或对齐值。";
  }

  private alignUp(value: number, alignment: number): number {
    return Math.ceil(value / alignment) * alignment;
  }

  private shiftedCfa(cfa: CfaPattern, x: number, y: number): CfaPattern {
    if (cfa === "MONO") return cfa;
    if (cfa.startsWith("Q")) return cfa;
    const grid: Record<Exclude<CfaPattern, "MONO" | "QRGGB" | "QBGGR" | "QGBRG" | "QGRBG">, CfaPattern[][]> = {
      RGGB: [["RGGB", "GRBG"], ["GBRG", "BGGR"]],
      BGGR: [["BGGR", "GBRG"], ["GRBG", "RGGB"]],
      GBRG: [["GBRG", "BGGR"], ["RGGB", "GRBG"]],
      GRBG: [["GRBG", "RGGB"], ["BGGR", "GBRG"]],
    };
    const bayer = cfa as keyof typeof grid;
    return grid[bayer][Math.abs(y) % 2][Math.abs(x) % 2];
  }

  private integerValue(id: string): number | null {
    const input = this.get<HTMLInputElement>(id);
    if (input.value.trim() === "") return null;
    const value = Number(input.value);
    return Number.isSafeInteger(value) ? value : null;
  }

  private value(id: string): number {
    return Number(this.get<HTMLInputElement>(id).value);
  }

  private setValue(id: string, value: number): void {
    this.get<HTMLInputElement>(id).value = String(value);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
  }

  private setFieldError(id: string, message: string): void {
    const field = this.root.querySelector<HTMLElement>(`[data-export-field="${id}"]`);
    if (!field) return;
    field.classList.add("invalid");
    field.querySelector("input, select")?.setAttribute("aria-invalid", "true");
    const error = field.querySelector<HTMLElement>(".export-field-error");
    if (error) error.textContent = message;
  }

  private clearFieldError(id: string): void {
    const field = this.root.querySelector<HTMLElement>(`[data-export-field="${id}"]`);
    if (!field) return;
    field.classList.remove("invalid");
    field.querySelector("input, select")?.removeAttribute("aria-invalid");
    const error = field.querySelector<HTMLElement>(".export-field-error");
    if (error) error.textContent = "";
  }

  private clearAllErrors(): void {
    this.root.querySelectorAll<HTMLElement>("[data-export-field]").forEach((field) => {
      field.classList.remove("invalid");
      field.querySelector("input, select")?.removeAttribute("aria-invalid");
      const error = field.querySelector<HTMLElement>(".export-field-error");
      if (error) error.textContent = "";
    });
  }
}
