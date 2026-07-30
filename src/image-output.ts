import { Image } from "@tauri-apps/api/image";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { savePng } from "./api";
import {
  canvasRgba,
  canvasToPngBlob,
} from "./image-capture";

export async function saveCanvasPng(canvas: HTMLCanvasElement, path: string): Promise<void> {
  const blob = await canvasToPngBlob(canvas);
  await savePng(path, new Uint8Array(await blob.arrayBuffer()));
}

export async function copyCanvasImage(canvas: HTMLCanvasElement): Promise<void> {
  const image = await Image.new(canvasRgba(canvas), canvas.width, canvas.height);
  try {
    await writeImage(image);
  } finally {
    await image.close();
  }
}
