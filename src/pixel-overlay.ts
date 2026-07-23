import { inspectPixels } from "./api";
import type {
  DemosaicPixelValueMode,
  DisplayMode,
  DocumentInfo,
  PixelInspectionRequest,
} from "./types";

const BYTES_PER_PIXEL = 10;
const GUARD_PIXELS = 3;

interface InspectionCache {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bytes: Uint8Array;
}

export interface PixelOverlayView {
  document: DocumentInfo;
  frame: number;
  displayMode: DisplayMode;
  zoom: number;
  cameraX: number;
  cameraY: number;
  width: number;
  height: number;
}

export class PixelValueOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly onError: (message: string) => void;
  private readonly requestDraw: () => void;
  private enabled = true;
  private demosaicValues: DemosaicPixelValueMode = "rgb";
  private cache: InspectionCache | null = null;
  private inFlight = "";
  private failedKey = "";
  private revision = 0;
  private visible = false;
  private currentView: PixelOverlayView | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: { onError(message: string): void; requestDraw(): void },
  ) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建像素值叠加画布");
    this.context = context;
    this.onError = callbacks.onError;
    this.requestDraw = callbacks.requestDraw;
  }

  setPreferences(preferences: { enabled: boolean; demosaicValues: DemosaicPixelValueMode }): void {
    const changed = this.enabled !== preferences.enabled || this.demosaicValues !== preferences.demosaicValues;
    this.enabled = preferences.enabled;
    this.demosaicValues = preferences.demosaicValues;
    if (changed) {
      this.visible = false;
      this.invalidate(false);
      this.requestDraw();
    }
  }

  resize(width: number, height: number, dpr: number): void {
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (this.canvas.width === pixelWidth && this.canvas.height === pixelHeight) return;
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.invalidate(false);
  }

  invalidate(resetVisibility = true): void {
    this.revision += 1;
    this.cache = null;
    this.inFlight = "";
    this.failedKey = "";
    this.currentView = null;
    if (resetVisibility) this.visible = false;
    this.clear();
  }

  clear(): void {
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(view: PixelOverlayView): void {
    this.currentView = view;
    const layout = this.layout(view);
    this.visible = layout.active;
    if (!layout.active) {
      this.clear();
      return;
    }
    const rect = this.visibleRect(view);
    if (!rect) {
      this.clear();
      return;
    }
    if (!this.cacheCovers(view, rect)) {
      this.clear();
      this.queue(view, rect);
      return;
    }
    this.drawValues(view, rect, layout);
  }

  private key(view: PixelOverlayView): string {
    return `${view.document.generation}:${view.frame}:${view.displayMode}`;
  }

  private layout(view: PixelOverlayView): { active: boolean; fontSize: number; lineHeight: number; rgbRows: boolean } {
    if (!this.enabled) return { active: false, fontSize: 10, lineHeight: 13, rgbRows: false };
    const rgbRows = view.displayMode === "demosaic" && this.demosaicValues === "rgb";
    const fontSize = Math.min(12, Math.max(10, view.zoom * 0.19));
    const lineHeight = fontSize + 2;
    const maxValue = this.maxValue(view);
    this.context.font = `600 ${fontSize}px "Cascadia Mono", Consolas, monospace`;
    const widestText = rgbRows ? `G ${maxValue}` : String(maxValue);
    const requiredWidth = this.context.measureText(widestText).width + 10;
    const requiredHeight = (rgbRows ? lineHeight * 3 : lineHeight) + 10;
    const requiredSize = Math.max(requiredWidth, requiredHeight);
    const active = this.visible ? view.zoom >= requiredSize - 4 : view.zoom >= requiredSize;
    return { active, fontSize, lineHeight, rgbRows };
  }

  private visibleRect(view: PixelOverlayView): { x: number; y: number; width: number; height: number } | null {
    const left = Math.max(0, Math.floor(-view.cameraX / view.zoom));
    const top = Math.max(0, Math.floor(-view.cameraY / view.zoom));
    const right = Math.min(
      view.document.descriptor.width,
      Math.ceil((view.width - view.cameraX) / view.zoom),
    );
    const bottom = Math.min(
      view.document.descriptor.height,
      Math.ceil((view.height - view.cameraY) / view.zoom),
    );
    if (right <= left || bottom <= top) return null;
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  private cacheCovers(
    view: PixelOverlayView,
    rect: { x: number; y: number; width: number; height: number },
  ): boolean {
    return Boolean(this.cache
      && this.cache.key === this.key(view)
      && rect.x >= this.cache.x
      && rect.y >= this.cache.y
      && rect.x + rect.width <= this.cache.x + this.cache.width
      && rect.y + rect.height <= this.cache.y + this.cache.height);
  }

  private drawValues(
    view: PixelOverlayView,
    rect: { x: number; y: number; width: number; height: number },
    layout: { fontSize: number; lineHeight: number; rgbRows: boolean },
  ): void {
    const cache = this.cache!;
    const dpr = this.canvas.width / view.width;
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.context.font = `600 ${layout.fontSize}px "Cascadia Mono", Consolas, monospace`;
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
    this.context.lineJoin = "round";
    const maxValue = this.maxValue(view);
    const normalize = (value: number) => value / Math.max(1, maxValue);
    const linearize = (value: number) => value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        const screenX = view.cameraX + x * view.zoom;
        const screenY = view.cameraY + y * view.zoom;
        const offset = ((y - cache.y) * cache.width + x - cache.x) * BYTES_PER_PIXEL;
        const flags = cache.bytes[offset];
        const raw = this.readU16(cache.bytes, offset + 2);
        const red = this.readU16(cache.bytes, offset + 4);
        const green = this.readU16(cache.bytes, offset + 6);
        const blue = this.readU16(cache.bytes, offset + 8);
        const rgbValid = (flags & 0b10) !== 0;
        const luminance = rgbValid
          ? 0.2126 * linearize(normalize(red))
            + 0.7152 * linearize(normalize(green))
            + 0.0722 * linearize(normalize(blue))
          : linearize(normalize(raw));
        const lightBackground = luminance > 0.179;
        this.context.strokeStyle = "rgba(142,205,228,.22)";
        this.context.lineWidth = 1;
        this.context.strokeRect(screenX + 0.5, screenY + 0.5, view.zoom - 1, view.zoom - 1);
        this.context.strokeStyle = lightBackground ? "rgba(255,255,255,.58)" : "rgba(0,0,0,.72)";
        this.context.fillStyle = lightBackground ? "rgba(7,10,14,.94)" : "rgba(244,250,253,.96)";
        this.context.lineWidth = Math.max(1.5, layout.fontSize * 0.18);
        const lines = layout.rgbRows
          ? rgbValid ? [`R ${red}`, `G ${green}`, `B ${blue}`] : ["R —", "G —", "B —"]
          : [(flags & 0b1) !== 0 ? String(raw) : "—"];
        const centerX = screenX + view.zoom / 2;
        const centerY = screenY + view.zoom / 2;
        const firstY = centerY - (lines.length - 1) * layout.lineHeight / 2;
        lines.forEach((line, index) => {
          const textY = firstY + index * layout.lineHeight;
          this.context.strokeText(line, centerX, textY);
          this.context.fillText(line, centerX, textY);
        });
      }
    }
  }

  private queue(
    view: PixelOverlayView,
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    if (this.inFlight) return;
    const requestRect = {
      x: Math.max(0, rect.x - GUARD_PIXELS),
      y: Math.max(0, rect.y - GUARD_PIXELS),
      width: 0,
      height: 0,
    };
    requestRect.width = Math.min(
      view.document.descriptor.width,
      rect.x + rect.width + GUARD_PIXELS,
    ) - requestRect.x;
    requestRect.height = Math.min(
      view.document.descriptor.height,
      rect.y + rect.height + GUARD_PIXELS,
    ) - requestRect.y;
    const baseKey = this.key(view);
    const requestKey = `${baseKey}:${requestRect.x}:${requestRect.y}:${requestRect.width}:${requestRect.height}`;
    if (baseKey === this.failedKey) return;
    const revision = this.revision;
    this.inFlight = requestKey;
    const request: PixelInspectionRequest = {
      generation: view.document.generation,
      frame: view.frame,
      x: requestRect.x,
      y: requestRect.y,
      width: requestRect.width,
      height: requestRect.height,
      mode: view.displayMode,
    };
    void inspectPixels(request).then((bytes) => {
      if (revision !== this.revision || !this.currentView || baseKey !== this.key(this.currentView)) return;
      const expectedLength = requestRect.width * requestRect.height * BYTES_PER_PIXEL;
      if (bytes.length !== expectedLength) throw new Error(`像素检查数据长度异常：预期 ${expectedLength} B，实际 ${bytes.length} B`);
      this.cache = { key: baseKey, ...requestRect, bytes };
      this.failedKey = "";
    }).catch((error: unknown) => {
      const message = String(error);
      if (!message.includes("stale_generation") && revision === this.revision) {
        this.failedKey = baseKey;
        this.onError(`高倍率像素值读取失败，已停止自动重试；修改参数、帧或显示模式后可重新尝试。\n${message}`);
      }
    }).finally(() => {
      if (this.inFlight === requestKey) this.inFlight = "";
      this.requestDraw();
    });
  }

  private maxValue(view: PixelOverlayView): number {
    return view.document.descriptor.bitDepth >= 16
      ? 65_535
      : (2 ** view.document.descriptor.bitDepth) - 1;
  }

  private readU16(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | bytes[offset + 1] << 8;
  }
}
