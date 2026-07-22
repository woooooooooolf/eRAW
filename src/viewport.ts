import { renderTile, samplePixel } from "./api";
import type { DisplayMode, DocumentInfo, PixelSample, TileRequest } from "./types";

const TILE_SIZE = 256;
const MAX_IN_FLIGHT = 8;
const MAX_TEXTURES = 192;
const KEEP_VISIBLE = 24;

interface DisplaySettings {
  mode: DisplayMode;
  displayMin: number;
  displayMax: number;
}

interface TextureEntry {
  texture: WebGLTexture;
  level: number;
  tileX: number;
  tileY: number;
  lastUsed: number;
}

export interface ViewportCallbacks {
  onZoomChange(zoom: number): void;
  onSampleChange(sample: PixelSample | null): void;
  onRenderStats(level: number, loaded: number, pending: number): void;
  onError(message: string): void;
}

const vertexShaderSource = `#version 300 es
in vec2 a_position;
uniform vec4 u_rect;
uniform vec2 u_viewport;
uniform vec2 u_camera;
uniform float u_zoom;
out vec2 v_uv;
void main() {
  vec2 imagePoint = u_rect.xy + a_position * u_rect.zw;
  vec2 screenPoint = u_camera + imagePoint * u_zoom;
  vec2 clip = vec2(screenPoint.x / u_viewport.x * 2.0 - 1.0, 1.0 - screenPoint.y / u_viewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_position;
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
in vec2 v_uv;
out vec4 outColor;
void main() { outColor = texture(u_texture, v_uv); }`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("无法创建 WebGL 着色器");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`WebGL 着色器编译失败：${log ?? "未知错误"}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("无法创建 WebGL 程序");
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`WebGL 程序链接失败：${gl.getProgramInfoLog(program) ?? "未知错误"}`);
  }
  return program;
}

export class RawViewport {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly overlayContext: CanvasRenderingContext2D;
  private readonly callbacks: ViewportCallbacks;
  private readonly program: WebGLProgram;
  private readonly rectLocation: WebGLUniformLocation;
  private readonly viewportLocation: WebGLUniformLocation;
  private readonly cameraLocation: WebGLUniformLocation;
  private readonly zoomLocation: WebGLUniformLocation;
  private readonly horizontalScrollbar: HTMLElement;
  private readonly horizontalThumb: HTMLElement;
  private readonly verticalScrollbar: HTMLElement;
  private readonly verticalThumb: HTMLElement;
  private readonly resizeObserver: ResizeObserver;
  private document: DocumentInfo | null = null;
  private frame = 0;
  private settings: DisplaySettings = { mode: "bayer", displayMin: 0, displayMax: 0 };
  private textures = new Map<string, TextureEntry>();
  private inFlight = new Set<string>();
  private zoom = 1;
  private fitScale = 1;
  private cameraX = 0;
  private cameraY = 0;
  private width = 1;
  private height = 1;
  private dragging = false;
  private dragX = 0;
  private dragY = 0;
  private dragCameraX = 0;
  private dragCameraY = 0;
  private overlayEnabled = true;
  private animationFrame = 0;
  private sampleTimer = 0;
  private lastSampleKey = "";
  private renderCounter = 0;

  constructor(container: HTMLElement, callbacks: ViewportCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.canvas = container.querySelector<HTMLCanvasElement>(".raw-canvas")!;
    this.overlay = container.querySelector<HTMLCanvasElement>(".overlay-canvas")!;
    const gl = this.canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: false });
    const overlayContext = this.overlay.getContext("2d");
    if (!gl || !overlayContext) throw new Error("当前 WebView2 不支持 eRAW 所需的 WebGL2 画布");
    this.gl = gl;
    this.overlayContext = overlayContext;
    this.program = createProgram(gl);
    this.rectLocation = this.requireUniform("u_rect");
    this.viewportLocation = this.requireUniform("u_viewport");
    this.cameraLocation = this.requireUniform("u_camera");
    this.zoomLocation = this.requireUniform("u_zoom");
    this.horizontalScrollbar = container.querySelector<HTMLElement>(".image-scrollbar.horizontal")!;
    this.horizontalThumb = this.horizontalScrollbar.querySelector<HTMLElement>(".scroll-thumb")!;
    this.verticalScrollbar = container.querySelector<HTMLElement>(".image-scrollbar.vertical")!;
    this.verticalThumb = this.verticalScrollbar.querySelector<HTMLElement>(".scroll-thumb")!;
    this.initializeGl();
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  private requireUniform(name: string): WebGLUniformLocation {
    const location = this.gl.getUniformLocation(this.program, name);
    if (!location) throw new Error(`WebGL uniform ${name} 不可用`);
    return location;
  }

  private initializeGl(): void {
    const { gl } = this;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_texture"), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private bindEvents(): void {
    this.canvas.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
    this.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    this.canvas.addEventListener("pointercancel", (event) => this.onPointerUp(event));
    this.canvas.addEventListener("pointerleave", () => this.scheduleSample(null));
    this.canvas.addEventListener("dblclick", () => {
      if (Math.abs(this.zoom - this.fitScale) < 0.001) this.actualSize(); else this.fit();
    });
    this.bindScrollbar(this.horizontalScrollbar, this.horizontalThumb, "x");
    this.bindScrollbar(this.verticalScrollbar, this.verticalThumb, "y");
  }

  private bindScrollbar(track: HTMLElement, thumb: HTMLElement, axis: "x" | "y"): void {
    const update = (event: PointerEvent) => {
      if (!this.document) return;
      const rect = track.getBoundingClientRect();
      const thumbSize = axis === "x" ? thumb.offsetWidth : thumb.offsetHeight;
      const trackSize = axis === "x" ? rect.width : rect.height;
      const position = (axis === "x" ? event.clientX - rect.left : event.clientY - rect.top) - thumbSize / 2;
      const progress = Math.max(0, Math.min(1, position / Math.max(1, trackSize - thumbSize)));
      if (axis === "x") {
        const imageSize = this.document.descriptor.width * this.zoom;
        const min = KEEP_VISIBLE - imageSize;
        const max = this.width - KEEP_VISIBLE;
        this.cameraX = max - progress * (max - min);
      } else {
        const imageSize = this.document.descriptor.height * this.zoom;
        const min = KEEP_VISIBLE - imageSize;
        const max = this.height - KEEP_VISIBLE;
        this.cameraY = max - progress * (max - min);
      }
      this.requestDraw();
    };
    track.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      track.setPointerCapture(event.pointerId);
      update(event);
    });
    track.addEventListener("pointermove", (event) => {
      if (track.hasPointerCapture(event.pointerId)) update(event);
    });
  }

  setDocument(document: DocumentInfo, preserveView = false): void {
    const dimensionsChanged = !this.document
      || document.descriptor.width !== this.document.descriptor.width
      || document.descriptor.height !== this.document.descriptor.height;
    this.document = document;
    this.frame = Math.min(this.frame, Math.max(0, document.layout.frameCount - 1));
    this.clearTextures();
    if (!preserveView || dimensionsChanged) this.fit(); else this.requestDraw();
  }

  setFrame(frame: number): void {
    if (!this.document) return;
    this.frame = Math.max(0, Math.min(frame, Math.max(0, this.document.layout.frameCount - 1)));
    this.clearTextures();
    this.requestDraw();
  }

  setDisplay(settings: DisplaySettings): void {
    if (settings.mode === this.settings.mode && settings.displayMin === this.settings.displayMin && settings.displayMax === this.settings.displayMax) return;
    this.settings = settings;
    this.clearTextures();
    this.requestDraw();
  }

  setOverlayEnabled(enabled: boolean): void {
    this.overlayEnabled = enabled;
    this.requestDraw();
  }

  fit(): void {
    if (!this.document) return;
    const margin = 72;
    this.fitScale = Math.min(
      Math.max(0.0001, (this.width - margin) / this.document.descriptor.width),
      Math.max(0.0001, (this.height - margin) / this.document.descriptor.height),
      1,
    );
    this.zoom = this.fitScale;
    this.cameraX = (this.width - this.document.descriptor.width * this.zoom) / 2;
    this.cameraY = (this.height - this.document.descriptor.height * this.zoom) / 2;
    this.callbacks.onZoomChange(this.zoom);
    this.requestDraw();
  }

  actualSize(): void {
    if (!this.document) return;
    const centerX = (this.width / 2 - this.cameraX) / this.zoom;
    const centerY = (this.height / 2 - this.cameraY) / this.zoom;
    this.zoom = 1;
    this.cameraX = this.width / 2 - centerX;
    this.cameraY = this.height / 2 - centerY;
    this.constrainCamera();
    this.callbacks.onZoomChange(this.zoom);
    this.requestDraw();
  }

  getZoom(): number { return this.zoom; }
  getFrame(): number { return this.frame; }

  private resize(): void {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(this.width * dpr);
    const pixelHeight = Math.round(this.height * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.overlay.width = pixelWidth;
      this.overlay.height = pixelHeight;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.overlay.style.width = `${this.width}px`;
      this.overlay.style.height = `${this.height}px`;
      this.overlayContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (this.document) {
      this.constrainCamera();
      this.requestDraw();
    } else {
      this.draw();
    }
  }

  private onWheel(event: WheelEvent): void {
    if (!this.document) return;
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const imageX = (pointerX - this.cameraX) / this.zoom;
    const imageY = (pointerY - this.cameraY) / this.zoom;
    const factor = Math.exp(-event.deltaY * 0.0015);
    const minZoom = Math.max(this.fitScale * 0.08, 0.0005);
    const newZoom = Math.max(minZoom, Math.min(64, this.zoom * factor));
    this.cameraX = pointerX - imageX * newZoom;
    this.cameraY = pointerY - imageY * newZoom;
    this.zoom = newZoom;
    this.constrainCamera();
    this.callbacks.onZoomChange(this.zoom);
    this.requestDraw();
  }

  private onPointerDown(event: PointerEvent): void {
    if (!this.document || event.button !== 0) return;
    this.dragging = true;
    this.dragX = event.clientX;
    this.dragY = event.clientY;
    this.dragCameraX = this.cameraX;
    this.dragCameraY = this.cameraY;
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.classList.add("dragging");
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.document) return;
    if (this.dragging) {
      this.cameraX = this.dragCameraX + event.clientX - this.dragX;
      this.cameraY = this.dragCameraY + event.clientY - this.dragY;
      this.constrainCamera();
      this.requestDraw();
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left - this.cameraX) / this.zoom);
    const y = Math.floor((event.clientY - rect.top - this.cameraY) / this.zoom);
    if (x >= 0 && y >= 0 && x < this.document.descriptor.width && y < this.document.descriptor.height) {
      this.scheduleSample({ x, y });
    } else {
      this.scheduleSample(null);
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.canvas.classList.remove("dragging");
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  }

  private scheduleSample(point: { x: number; y: number } | null): void {
    window.clearTimeout(this.sampleTimer);
    if (!point) {
      this.lastSampleKey = "";
      this.callbacks.onSampleChange(null);
      return;
    }
    const key = `${this.frame}:${point.x}:${point.y}`;
    if (key === this.lastSampleKey) return;
    this.lastSampleKey = key;
    this.sampleTimer = window.setTimeout(async () => {
      try {
        this.callbacks.onSampleChange(await samplePixel(point.x, point.y, this.frame));
      } catch {
        this.callbacks.onSampleChange(null);
      }
    }, 55);
  }

  private constrainCamera(): void {
    if (!this.document) return;
    const imageWidth = this.document.descriptor.width * this.zoom;
    const imageHeight = this.document.descriptor.height * this.zoom;
    this.cameraX = Math.max(KEEP_VISIBLE - imageWidth, Math.min(this.width - KEEP_VISIBLE, this.cameraX));
    this.cameraY = Math.max(KEEP_VISIBLE - imageHeight, Math.min(this.height - KEEP_VISIBLE, this.cameraY));
  }

  private requestDraw(): void {
    if (this.animationFrame) return;
    this.animationFrame = requestAnimationFrame(() => {
      this.animationFrame = 0;
      this.draw();
    });
  }

  private currentLevel(): number {
    if (!this.document || this.zoom >= 1) return 0;
    const ideal = Math.max(0, Math.floor(Math.log2(1 / this.zoom)));
    const maxLevel = Math.max(0, Math.ceil(Math.log2(Math.max(this.document.descriptor.width, this.document.descriptor.height) / TILE_SIZE)));
    return Math.min(ideal, maxLevel, 30);
  }

  private tileKey(level: number, x: number, y: number): string {
    if (!this.document) return "";
    return `${this.document.generation}:${this.frame}:${this.settings.mode}:${this.settings.displayMin}:${this.settings.displayMax}:${level}:${x}:${y}`;
  }

  private visibleTiles(level: number): Array<{ x: number; y: number }> {
    if (!this.document) return [];
    const scale = 2 ** level;
    const span = TILE_SIZE * scale;
    const left = Math.max(0, (-this.cameraX / this.zoom));
    const top = Math.max(0, (-this.cameraY / this.zoom));
    const right = Math.min(this.document.descriptor.width, (this.width - this.cameraX) / this.zoom);
    const bottom = Math.min(this.document.descriptor.height, (this.height - this.cameraY) / this.zoom);
    const startX = Math.max(0, Math.floor(left / span) - 1);
    const startY = Math.max(0, Math.floor(top / span) - 1);
    const endX = Math.min(Math.ceil(this.document.descriptor.width / span) - 1, Math.floor(right / span) + 1);
    const endY = Math.min(Math.ceil(this.document.descriptor.height / span) - 1, Math.floor(bottom / span) + 1);
    const result: Array<{ x: number; y: number }> = [];
    for (let y = startY; y <= endY; y += 1) for (let x = startX; x <= endX; x += 1) result.push({ x, y });
    const centerX = (left + right) / 2 / span;
    const centerY = (top + bottom) / 2 / span;
    result.sort((a, b) => Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY));
    return result;
  }

  private draw(): void {
    const { gl } = this;
    const dpr = this.canvas.width / this.width;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.overlayContext.clearRect(0, 0, this.width, this.height);
    if (!this.document) {
      this.updateScrollbars();
      return;
    }
    const level = this.currentLevel();
    const visible = this.visibleTiles(level);
    const scale = 2 ** level;
    gl.useProgram(this.program);
    gl.uniform2f(this.viewportLocation, this.width * dpr, this.height * dpr);
    gl.uniform2f(this.cameraLocation, this.cameraX * dpr, this.cameraY * dpr);
    gl.uniform1f(this.zoomLocation, this.zoom * dpr);
    for (const tile of visible) {
      const key = this.tileKey(level, tile.x, tile.y);
      const entry = this.textures.get(key);
      if (!entry) {
        this.queueTile(key, level, tile.x, tile.y);
        continue;
      }
      entry.lastUsed = ++this.renderCounter;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.uniform4f(this.rectLocation, tile.x * TILE_SIZE * scale, tile.y * TILE_SIZE * scale, TILE_SIZE * scale, TILE_SIZE * scale);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    this.drawOverlay();
    this.updateScrollbars();
    this.callbacks.onRenderStats(level, visible.filter((tile) => this.textures.has(this.tileKey(level, tile.x, tile.y))).length, this.inFlight.size);
  }

  private queueTile(key: string, level: number, tileX: number, tileY: number): void {
    if (!this.document || this.inFlight.has(key) || this.inFlight.size >= MAX_IN_FLIGHT) return;
    this.inFlight.add(key);
    const request: TileRequest = {
      generation: this.document.generation,
      frame: this.frame,
      level,
      tileX,
      tileY,
      tileSize: TILE_SIZE,
      mode: this.settings.mode,
      displayMin: this.settings.displayMin,
      displayMax: this.settings.displayMax,
    };
    void renderTile(request).then((bytes) => {
      if (!this.document || key !== this.tileKey(level, tileX, tileY)) return;
      const texture = this.gl.createTexture();
      if (!texture) throw new Error("GPU 纹理分配失败");
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, TILE_SIZE, TILE_SIZE, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, bytes);
      this.textures.set(key, { texture, level, tileX, tileY, lastUsed: ++this.renderCounter });
      this.evictTextures();
    }).catch((error: unknown) => {
      const message = String(error);
      if (!message.includes("stale_generation")) this.callbacks.onError(message);
    }).finally(() => {
      this.inFlight.delete(key);
      this.requestDraw();
    });
  }

  private evictTextures(): void {
    if (this.textures.size <= MAX_TEXTURES) return;
    const entries = [...this.textures.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [key, entry] of entries.slice(0, this.textures.size - MAX_TEXTURES)) {
      this.gl.deleteTexture(entry.texture);
      this.textures.delete(key);
    }
  }

  private clearTextures(): void {
    for (const entry of this.textures.values()) this.gl.deleteTexture(entry.texture);
    this.textures.clear();
    this.inFlight.clear();
  }

  private drawOverlay(): void {
    if (!this.document || !this.overlayEnabled) return;
    const context = this.overlayContext;
    const descriptor = this.document.descriptor;
    const layout = this.document.layout;
    const x = this.cameraX;
    const y = this.cameraY;
    const imageWidth = descriptor.width * this.zoom;
    const imageHeight = descriptor.height * this.zoom;
    const rowRatio = layout.rowBytes > 0 ? Math.max(1, Math.min(2, layout.rowStride / layout.rowBytes)) : 1;
    const frameRatio = layout.frameBytes > 0 ? Math.max(1, Math.min(2, layout.frameStride / layout.frameBytes)) : 1;
    const alignedWidth = imageWidth * rowRatio;
    const alignedHeight = imageHeight * frameRatio;

    context.save();
    context.lineWidth = 1;
    if (alignedWidth > imageWidth + 1) {
      context.fillStyle = "rgba(27, 172, 225, 0.08)";
      context.fillRect(x + imageWidth, y, alignedWidth - imageWidth, imageHeight);
      this.drawHatch(x + imageWidth, y, alignedWidth - imageWidth, imageHeight, "rgba(70, 201, 245, .20)");
    }
    if (alignedHeight > imageHeight + 1) {
      context.fillStyle = "rgba(121, 94, 255, 0.08)";
      context.fillRect(x, y + imageHeight, alignedWidth, alignedHeight - imageHeight);
      this.drawHatch(x, y + imageHeight, alignedWidth, alignedHeight - imageHeight, "rgba(148, 120, 255, .18)");
    }
    context.strokeStyle = "rgba(122, 219, 255, .72)";
    context.strokeRect(x - 0.5, y - 0.5, imageWidth + 1, imageHeight + 1);
    if (alignedWidth > imageWidth + 1 || alignedHeight > imageHeight + 1) {
      context.strokeStyle = "rgba(111, 137, 164, .48)";
      context.setLineDash([5, 5]);
      context.strokeRect(x - 0.5, y - 0.5, alignedWidth + 1, alignedHeight + 1);
      context.setLineDash([]);
    }
    this.drawDimensionLabels(x, y, imageWidth, imageHeight, alignedWidth, alignedHeight);
    if (this.zoom >= 12) this.drawPixelGrid(x, y, imageWidth, imageHeight);
    context.restore();
  }

  private drawHatch(x: number, y: number, width: number, height: number, color: string): void {
    const context = this.overlayContext;
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.strokeStyle = color;
    context.lineWidth = 1;
    for (let offset = -height; offset < width; offset += 9) {
      context.beginPath();
      context.moveTo(x + offset, y + height);
      context.lineTo(x + offset + height, y);
      context.stroke();
    }
    context.restore();
  }

  private drawDimensionLabels(x: number, y: number, width: number, height: number, alignedWidth: number, alignedHeight: number): void {
    if (!this.document) return;
    const context = this.overlayContext;
    context.font = "11px 'Segoe UI Variable', sans-serif";
    context.textBaseline = "middle";
    const topY = Math.max(18, y - 18);
    context.strokeStyle = "rgba(124, 205, 235, .72)";
    context.fillStyle = "rgba(181, 224, 242, .92)";
    context.beginPath(); context.moveTo(x, topY); context.lineTo(x + width, topY); context.stroke();
    context.textAlign = "center";
    context.fillText(`width ${this.document.descriptor.width}px · ${this.document.layout.rowBytes}B`, x + width / 2, topY - 7);
    if (alignedWidth > width + 16) {
      context.fillStyle = "rgba(107, 201, 237, .82)";
      context.fillText(`row padding ${this.document.layout.rowStride - this.document.layout.rowBytes}B`, x + width + (alignedWidth - width) / 2, topY - 7);
    }
    const leftX = Math.max(12, x - 18);
    context.save();
    context.translate(leftX, y + height / 2);
    context.rotate(-Math.PI / 2);
    context.fillStyle = "rgba(181, 224, 242, .92)";
    context.fillText(`height ${this.document.descriptor.height}px`, 0, 0);
    context.restore();
    if (alignedHeight > height + 18) {
      context.fillStyle = "rgba(166, 148, 255, .82)";
      context.fillText(`frame padding ${this.document.layout.frameStride - this.document.layout.frameBytes}B`, x + Math.min(alignedWidth, this.width) / 2, y + height + (alignedHeight - height) / 2);
    }
  }

  private drawPixelGrid(x: number, y: number, width: number, height: number): void {
    const context = this.overlayContext;
    const startX = Math.max(0, Math.floor(-x / this.zoom));
    const startY = Math.max(0, Math.floor(-y / this.zoom));
    const endX = Math.min(this.document!.descriptor.width, Math.ceil((this.width - x) / this.zoom));
    const endY = Math.min(this.document!.descriptor.height, Math.ceil((this.height - y) / this.zoom));
    context.strokeStyle = "rgba(183, 219, 233, .16)";
    context.lineWidth = 1;
    context.beginPath();
    for (let px = startX; px <= endX; px += 1) { const sx = x + px * this.zoom; context.moveTo(sx, Math.max(0, y)); context.lineTo(sx, Math.min(this.height, y + height)); }
    for (let py = startY; py <= endY; py += 1) { const sy = y + py * this.zoom; context.moveTo(Math.max(0, x), sy); context.lineTo(Math.min(this.width, x + width), sy); }
    context.stroke();
  }

  private updateScrollbars(): void {
    if (!this.document) {
      this.horizontalScrollbar.classList.remove("visible");
      this.verticalScrollbar.classList.remove("visible");
      return;
    }
    const imageWidth = this.document.descriptor.width * this.zoom;
    const imageHeight = this.document.descriptor.height * this.zoom;
    this.updateScrollbarAxis(this.horizontalScrollbar, this.horizontalThumb, imageWidth, this.width, this.cameraX, "x");
    this.updateScrollbarAxis(this.verticalScrollbar, this.verticalThumb, imageHeight, this.height, this.cameraY, "y");
  }

  private updateScrollbarAxis(track: HTMLElement, thumb: HTMLElement, imageSize: number, viewportSize: number, camera: number, axis: "x" | "y"): void {
    const visible = imageSize > viewportSize + 1;
    track.classList.toggle("visible", visible);
    if (!visible) return;
    const trackSize = axis === "x" ? track.clientWidth : track.clientHeight;
    const thumbSize = Math.max(42, Math.min(trackSize, trackSize * viewportSize / imageSize));
    const min = KEEP_VISIBLE - imageSize;
    const max = viewportSize - KEEP_VISIBLE;
    const progress = Math.max(0, Math.min(1, (max - camera) / Math.max(1, max - min)));
    if (axis === "x") {
      thumb.style.width = `${thumbSize}px`;
      thumb.style.transform = `translateX(${progress * (trackSize - thumbSize)}px)`;
    } else {
      thumb.style.height = `${thumbSize}px`;
      thumb.style.transform = `translateY(${progress * (trackSize - thumbSize)}px)`;
    }
  }
}
