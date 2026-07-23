import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  DocumentInfo,
  ExportRequest,
  ExportResult,
  PixelInspectionRequest,
  PixelSample,
  RawDescriptor,
  TileRequest,
} from "./types";

export async function chooseRawFile(): Promise<string | null> {
  const result = await open({
    title: "打开 RAW 图像",
    multiple: false,
    directory: false,
    filters: [{ name: "RAW 图像", extensions: ["raw", "bin"] }],
  });
  return typeof result === "string" ? result : null;
}

export async function chooseExportFile(defaultPath: string): Promise<string | null> {
  const result = await save({
    title: "导出 RAW 数据",
    defaultPath,
    filters: [{ name: "RAW 图像", extensions: ["raw"] }],
  });
  return result ?? null;
}

export function openDocument(path: string, descriptor: RawDescriptor): Promise<DocumentInfo> {
  return invoke("open_document", { path, descriptor });
}

export function updateDescriptor(descriptor: RawDescriptor): Promise<DocumentInfo> {
  return invoke("update_descriptor", { descriptor });
}

export async function renderTile(request: TileRequest): Promise<Uint8Array> {
  const result = await invoke<ArrayBuffer | Uint8Array | number[]>("render_raw_tile", { request });
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  if (result instanceof Uint8Array) return result;
  return new Uint8Array(result);
}

export async function inspectPixels(request: PixelInspectionRequest): Promise<Uint8Array> {
  const result = await invoke<ArrayBuffer | Uint8Array | number[]>("inspect_raw_pixels", { request });
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  if (result instanceof Uint8Array) return result;
  return new Uint8Array(result);
}

export function samplePixel(x: number, y: number, frame: number): Promise<PixelSample> {
  return invoke("sample_raw_pixel", { x, y, frame });
}

export function exportDocument(request: ExportRequest): Promise<ExportResult> {
  return invoke("export_document", { request });
}
