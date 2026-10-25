import { Image } from "@tauri-apps/api/image";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { savePng } from "./api";
import type { CaptureJob } from "./image-capture-session";
import {
  canvasRgba,
  canvasToPngBlob,
} from "./image-capture";

export async function saveCanvasPng(canvas: HTMLCanvasElement, path: string, job?: CaptureJob): Promise<void> {
  job?.check();
  const blob = await canvasToPngBlob(canvas);
  job?.check();
  const png = new Uint8Array(await blob.arrayBuffer());
  job?.commit();
  await savePng(path, png);
}

export async function copyCanvasImage(canvas: HTMLCanvasElement, job?: CaptureJob): Promise<void> {
  job?.check();
  const image = await Image.new(canvasRgba(canvas), canvas.width, canvas.height);
  try {
    job?.commit();
    await writeImage(image);
  } finally {
    await image.close();
  }
}
