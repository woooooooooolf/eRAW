import { renderTile } from "./api";
import { PixelValueOverlay } from "./pixel-overlay";
import {
  DEFAULT_PROCESSING_SETTINGS,
  type DemosaicPixelValueMode,
  type DisplayMode,
  type DocumentInfo,
  type ProcessingSettings,
  type TileRequest,
} from "./types";
import { ViewportOverlayLayer } from "./viewport-overlay";
import { ViewportTransform, type ImagePoint } from "./viewport-transform";

export type { ImagePoint } from "./viewport-transform";

const TILE_SIZE = 256;
const MAX_IN_FLIGHT = 8;
const DEFAULT_MAX_TEXTURES = 192;
const KEEP_VISIBLE = 24;
const MAX_ZOOM = 64;

interface DisplaySettings {
  mode: DisplayMode;
  processing: ProcessingSettings;
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

interface LodPlan {
  fineLevel: number;
  coarseLevel: number | null;
  blend: number;
}

export interface ViewportCallbacks {
  onZoomChange(zoom: number): void;
  onSampleChange(sample: ImagePoint | null): void;
  onRenderStats(levelLabel: string, loaded: number, pending: number): void;
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
uniform float u_opacity;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec4 color = texture(u_texture, v_uv);
  outColor = vec4(color.rgb, color.a * u_opacity);
}`;

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
  private readonly pixelValueOverlay: PixelValueOverlay;
  private readonly gl: WebGL2RenderingContext;
  private readonly callbacks: ViewportCallbacks;
  private readonly program: WebGLProgram;
  private readonly rectLocation: WebGLUniformLocation;
  private readonly viewportLocation: WebGLUniformLocation;
  private readonly cameraLocation: WebGLUniformLocation;
  private readonly zoomLocation: WebGLUniformLocation;
  private readonly opacityLocation: WebGLUniformLocation;
  private readonly horizontalScrollbar: HTMLElement;
  private readonly horizontalThumb: HTMLElement;
  private readonly verticalScrollbar: HTMLElement;
  private readonly verticalThumb: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly overlayLayer: ViewportOverlayLayer;
  private readonly transform = new ViewportTransform();
  private readonly resizeObserver: ResizeObserver;
  private document: DocumentInfo | null = null;
  private frame = 0;
  private settings: DisplaySettings = {
    mode: "bayer",
    processing: DEFAULT_PROCESSING_SETTINGS,
    displayMin: 0,
    displayMax: 0,
  };
  private textures = new Map<string, TextureEntry>();
  private inFlight = new Set<string>();
  private failedTiles = new Set<string>();
  private failureReported = false;
  private fitScale = 1;
  private width = 1;
  private height = 1;
  private dragging = false;
  private selecting = false;
  private interactionMode: "pan" | "select" = "pan";
  private dragX = 0;
  private dragY = 0;
  private dragCameraX = 0;
  private dragCameraY = 0;
  private maxTextures = DEFAULT_MAX_TEXTURES;
  private wheelSensitivity = 0.0015;
  private animationFrame = 0;
  private lastSampleKey = "";
  private renderCounter = 0;

  private get zoom(): number { return this.transform.zoom; }
  private set zoom(value: number) { this.transform.zoom = value; }
  private get cameraX(): number { return this.transform.cameraX; }
  private set cameraX(value: number) { this.transform.cameraX = value; }
  private get cameraY(): number { return this.transform.cameraY; }
  private set cameraY(value: number) { this.transform.cameraY = value; }

  constructor(container: HTMLElement, callbacks: ViewportCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.canvas = container.querySelector<HTMLCanvasElement>(".raw-canvas")!;
    this.pixelValueOverlay = new PixelValueOverlay(
      container.querySelector<HTMLCanvasElement>(".pixel-value-overlay")!,
      {
        onError: (message) => this.callbacks.onError(message),
        requestDraw: () => this.requestDraw(),
      },
    );
    const gl = this.canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error("当前 WebView2 不支持 eRAW 所需的 WebGL2 画布");
    this.gl = gl;
    this.program = createProgram(gl);
    this.rectLocation = this.requireUniform("u_rect");
    this.viewportLocation = this.requireUniform("u_viewport");
    this.cameraLocation = this.requireUniform("u_camera");
    this.zoomLocation = this.requireUniform("u_zoom");
    this.opacityLocation = this.requireUniform("u_opacity");
    this.horizontalScrollbar = container.querySelector<HTMLElement>(".image-scrollbar.horizontal")!;
    this.horizontalThumb = this.horizontalScrollbar.querySelector<HTMLElement>(".scroll-thumb")!;
    this.verticalScrollbar = container.querySelector<HTMLElement>(".image-scrollbar.vertical")!;
    this.verticalThumb = this.verticalScrollbar.querySelector<HTMLElement>(".scroll-thumb")!;
    this.crosshair = container.querySelector<HTMLElement>(".canvas-crosshair")!;
    this.overlayLayer = new ViewportOverlayLayer(
      container.querySelector<SVGSVGElement>(".image-boundary")!,
    );
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
    this.canvas.addEventListener("pointerleave", () => {
      this.hideCrosshair();
      this.updatePointerPosition(null);
    });
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
    if (dimensionsChanged) this.overlayLayer.clearSelection();
    this.updatePointerPosition(null);
    this.frame = Math.min(this.frame, Math.max(0, document.layout.frameCount - 1));
    this.clearTextures();
    if (!preserveView || dimensionsChanged) this.fit(); else this.requestDraw();
  }

  setFrame(frame: number): void {
    if (!this.document) return;
    this.frame = Math.max(0, Math.min(frame, Math.max(0, this.document.layout.frameCount - 1)));
    this.updatePointerPosition(null);
    this.clearTextures();
    this.requestDraw();
  }

  setDisplay(settings: DisplaySettings): void {
    if (
      settings.mode === this.settings.mode
      && settings.displayMin === this.settings.displayMin
      && settings.displayMax === this.settings.displayMax
      && settings.processing.demosaicAlgorithm === this.settings.processing.demosaicAlgorithm
      && settings.processing.remosaic.sameColorReconstruction
        === this.settings.processing.remosaic.sameColorReconstruction
    ) return;
    this.settings = settings;
    this.clearTextures();
    this.requestDraw();
  }

  setPreferences(preferences: { wheelSensitivity: number; maxTextures: number }): void {
    this.wheelSensitivity = Math.max(0.0005, Math.min(0.004, preferences.wheelSensitivity));
    this.maxTextures = Math.max(64, Math.min(512, Math.trunc(preferences.maxTextures)));
    this.evictTextures();
  }

  setPixelInspectionPreferences(preferences: { enabled: boolean; demosaicValues: DemosaicPixelValueMode }): void {
    this.pixelValueOverlay.setPreferences(preferences);
  }

  setInteractionMode(mode: "pan" | "select"): void {
    this.interactionMode = mode;
    this.dragging = false;
    this.selecting = false;
    this.canvas.classList.remove("dragging");
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
    this.setZoom(1);
  }

  focusPixel(point: ImagePoint): void {
    if (!this.document
      || point.x < 0 || point.y < 0
      || point.x >= this.document.descriptor.width
      || point.y >= this.document.descriptor.height) return;
    this.zoom = MAX_ZOOM;
    this.cameraX = this.width / 2 - (point.x + 0.5) * this.zoom;
    this.cameraY = this.height / 2 - (point.y + 0.5) * this.zoom;
    this.constrainCamera();
    this.updatePointerPosition(point);
    this.callbacks.onZoomChange(this.zoom);
    this.requestDraw();
  }

  getZoom(): number { return this.zoom; }
  getFrame(): number { return this.frame; }
  getZoomRange(): { min: number; max: number } {
    return { min: this.minimumZoom(), max: MAX_ZOOM };
  }

  setZoom(zoom: number): void {
    if (!this.document || !Number.isFinite(zoom)) return;
    const center = { x: this.width / 2, y: this.height / 2 };
    const imagePoint = this.transform.screenToImage(center);
    this.zoom = Math.max(this.minimumZoom(), Math.min(MAX_ZOOM, zoom));
    this.cameraX = center.x - imagePoint.x * this.zoom;
    this.cameraY = center.y - imagePoint.y * this.zoom;
    if (Math.abs(this.zoom - 1) < 1e-9) this.snapCameraToPhysicalPixels();
    this.constrainCamera();
    this.callbacks.onZoomChange(this.zoom);
    this.requestDraw();
  }

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
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
    }
    this.pixelValueOverlay.resize(this.width, this.height, dpr);
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
    const imagePoint = this.transform.screenToImage({ x: pointerX, y: pointerY });
    const factor = Math.exp(-event.deltaY * this.wheelSensitivity);
    const minZoom = this.minimumZoom();
    const newZoom = Math.max(minZoom, Math.min(MAX_ZOOM, this.zoom * factor));
    this.cameraX = pointerX - imagePoint.x * newZoom;
    this.cameraY = pointerY - imagePoint.y * newZoom;
    this.zoom = newZoom;
    this.constrainCamera();
    this.updatePointerPosition(this.updateCrosshair(event));
    this.callbacks.onZoomChange(this.zoom);
    this.requestDraw();
  }

  private onPointerDown(event: PointerEvent): void {
    if (!this.document || event.button !== 0) return;
    const point = this.eventPoint(event);
    if (this.interactionMode === "select") {
      this.selecting = true;
      this.overlayLayer.beginSelection(
        this.transform.screenToImage(point),
        this.document.descriptor.width,
        this.document.descriptor.height,
      );
      this.canvas.setPointerCapture(event.pointerId);
      this.requestDraw();
      return;
    }
    this.dragging = true;
    this.updatePointerPosition(null);
    this.dragX = event.clientX;
    this.dragY = event.clientY;
    this.dragCameraX = this.cameraX;
    this.dragCameraY = this.cameraY;
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.classList.add("dragging");
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.document) return;
    if (this.selecting) {
      this.overlayLayer.updateSelection(
        this.transform.screenToImage(this.eventPoint(event)),
        this.document.descriptor.width,
        this.document.descriptor.height,
      );
      this.updatePointerPosition(this.updateCrosshair(event));
      this.requestDraw();
      return;
    }
    if (this.dragging) {
      this.cameraX = this.dragCameraX + event.clientX - this.dragX;
      this.cameraY = this.dragCameraY + event.clientY - this.dragY;
      this.constrainCamera();
      this.updateCrosshair(event);
      this.requestDraw();
      return;
    }
    this.updatePointerPosition(this.updateCrosshair(event));
  }

  private onPointerUp(event: PointerEvent): void {
    if (this.selecting) {
      this.selecting = false;
      this.overlayLayer.endSelection();
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      this.updatePointerPosition(this.updateCrosshair(event));
      this.requestDraw();
      return;
    }
    if (!this.dragging) return;
    this.dragging = false;
    this.canvas.classList.remove("dragging");
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.updatePointerPosition(this.updateCrosshair(event));
  }

  private updateCrosshair(event: MouseEvent): ImagePoint | null {
    if (!this.document) {
      this.hideCrosshair();
      return null;
    }
    const rect = this.canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    if (pointerX < 0 || pointerY < 0 || pointerX >= rect.width || pointerY >= rect.height) {
      this.hideCrosshair();
      return null;
    }
    const pixel = this.transform.screenToPixel(
      { x: pointerX, y: pointerY },
      this.document.descriptor.width,
      this.document.descriptor.height,
    );
    if (!pixel) {
      this.hideCrosshair();
      return null;
    }
    const screen = this.transform.imageToScreen({ x: pixel.x + 0.5, y: pixel.y + 0.5 });
    const screenX = screen.x;
    const screenY = screen.y;
    this.crosshair.style.setProperty("--crosshair-x", `${screenX}px`);
    this.crosshair.style.setProperty("--crosshair-y", `${screenY}px`);
    this.crosshair.classList.add("visible");
    return pixel;
  }

  private eventPoint(event: MouseEvent): ImagePoint {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private hideCrosshair(): void {
    this.crosshair.classList.remove("visible");
  }

  private updatePointerPosition(point: ImagePoint | null): void {
    if (!point) {
      if (!this.lastSampleKey) return;
      this.lastSampleKey = "";
      this.callbacks.onSampleChange(null);
      return;
    }
    const key = `${this.frame}:${point.x}:${point.y}`;
    if (key === this.lastSampleKey) return;
    this.lastSampleKey = key;
    this.callbacks.onSampleChange(point);
  }

  private constrainCamera(): void {
    if (!this.document) return;
    const imageWidth = this.document.descriptor.width * this.zoom;
    const imageHeight = this.document.descriptor.height * this.zoom;
    this.cameraX = Math.max(KEEP_VISIBLE - imageWidth, Math.min(this.width - KEEP_VISIBLE, this.cameraX));
    this.cameraY = Math.max(KEEP_VISIBLE - imageHeight, Math.min(this.height - KEEP_VISIBLE, this.cameraY));
  }

  private minimumZoom(): number {
    return Math.max(this.fitScale * 0.08, 0.0005);
  }

  private snapCameraToPhysicalPixels(): void {
    const scaleX = this.canvas.width / this.width;
    const scaleY = this.canvas.height / this.height;
    this.cameraX = Math.round(this.cameraX * scaleX) / scaleX;
    this.cameraY = Math.round(this.cameraY * scaleY) / scaleY;
  }

  private requestDraw(): void {
    if (this.animationFrame) return;
    this.animationFrame = requestAnimationFrame(() => {
      this.animationFrame = 0;
      this.draw();
    });
  }

  private maximumLevel(): number {
    if (!this.document) return 0;
    const maxLevel = Math.max(
      0,
      Math.ceil(Math.log2(Math.max(this.document.descriptor.width, this.document.descriptor.height))),
    );
    return Math.min(maxLevel, 30);
  }

  private lodPlan(): LodPlan {
    const maxLevel = this.maximumLevel();
    if (!this.document || this.zoom >= 1 || maxLevel === 0) {
      return { fineLevel: 0, coarseLevel: null, blend: 0 };
    }
    const ideal = Math.max(0, Math.min(maxLevel, Math.log2(1 / this.zoom)));
    const fineLevel = Math.floor(ideal);
    const blend = ideal - fineLevel;
    if (fineLevel >= maxLevel || blend < 0.015) {
      return { fineLevel, coarseLevel: null, blend: 0 };
    }
    return { fineLevel, coarseLevel: fineLevel + 1, blend };
  }

  private tileKey(level: number, x: number, y: number): string {
    if (!this.document) return "";
    return `${this.document.generation}:${this.frame}:${this.settings.mode}:${this.settings.processing.demosaicAlgorithm}:${this.settings.processing.remosaic.sameColorReconstruction}:${this.settings.displayMin}:${this.settings.displayMax}:${level}:${x}:${y}`;
  }

  private visibleTiles(level: number): Array<{ x: number; y: number }> {
    if (!this.document) return [];
    const scale = 2 ** level;
    const span = TILE_SIZE * scale;
    const visibleRect = this.transform.visibleImageRect(
      this.width,
      this.height,
      this.document.descriptor.width,
      this.document.descriptor.height,
    );
    if (!visibleRect) return [];
    const left = visibleRect.x;
    const top = visibleRect.y;
    const right = visibleRect.x + visibleRect.width;
    const bottom = visibleRect.y + visibleRect.height;
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
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.updateImageBoundary();
    if (!this.document) {
      this.pixelValueOverlay.clear();
      this.updateScrollbars();
      return;
    }
    const plan = this.lodPlan();
    const fineVisible = this.visibleTiles(plan.fineLevel);
    const coarseVisible = plan.coarseLevel === null ? [] : this.visibleTiles(plan.coarseLevel);
    gl.useProgram(this.program);
    gl.uniform2f(this.viewportLocation, this.width, this.height);
    gl.uniform2f(this.cameraLocation, this.cameraX, this.cameraY);
    gl.uniform1f(this.zoomLocation, this.zoom);
    const fineLoaded = this.drawLayer(plan.fineLevel, fineVisible, 1);
    const coarseLoaded = plan.coarseLevel === null
      ? 0
      : this.drawLayer(plan.coarseLevel, coarseVisible, plan.blend);
    this.updateScrollbars();
    const levelLabel = plan.coarseLevel === null
      ? `L${plan.fineLevel}`
      : `L${plan.fineLevel}↔L${plan.coarseLevel}`;
    this.callbacks.onRenderStats(levelLabel, fineLoaded + coarseLoaded, this.inFlight.size);
    this.pixelValueOverlay.draw({
      document: this.document,
      frame: this.frame,
      displayMode: this.settings.mode,
      processing: this.settings.processing,
      transform: this.transform,
      width: this.width,
      height: this.height,
    });
  }

  private drawLayer(level: number, visible: Array<{ x: number; y: number }>, opacity: number): number {
    const { gl } = this;
    const scale = 2 ** level;
    let loaded = 0;
    gl.uniform1f(this.opacityLocation, opacity);
    for (const tile of visible) {
      const key = this.tileKey(level, tile.x, tile.y);
      const entry = this.textures.get(key);
      if (!entry) {
        this.queueTile(key, level, tile.x, tile.y);
        continue;
      }
      loaded += 1;
      entry.lastUsed = ++this.renderCounter;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.uniform4f(this.rectLocation, tile.x * TILE_SIZE * scale, tile.y * TILE_SIZE * scale, TILE_SIZE * scale, TILE_SIZE * scale);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    return loaded;
  }

  private updateImageBoundary(): void {
    if (!this.document) {
      this.overlayLayer.hide();
      return;
    }
    this.overlayLayer.update(
      this.transform,
      this.document.descriptor.width,
      this.document.descriptor.height,
    );
  }

  private queueTile(key: string, level: number, tileX: number, tileY: number): void {
    if (!this.document || this.inFlight.has(key) || this.failedTiles.has(key) || this.inFlight.size >= MAX_IN_FLIGHT) return;
    this.inFlight.add(key);
    const request: TileRequest = {
      generation: this.document.generation,
      frame: this.frame,
      level,
      tileX,
      tileY,
      tileSize: TILE_SIZE,
      mode: this.settings.mode,
      processing: this.settings.processing,
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
      const belongsToCurrentView = this.document && key === this.tileKey(level, tileX, tileY);
      if (!message.includes("stale_generation") && belongsToCurrentView) {
        this.failedTiles.add(key);
        if (!this.failureReported) {
          this.failureReported = true;
          this.callbacks.onError(`部分瓦片渲染失败，已停止自动重试；修改参数、帧或显示模式后可重新尝试。\n${message}`);
        }
      }
    }).finally(() => {
      this.inFlight.delete(key);
      this.requestDraw();
    });
  }

  private evictTextures(): void {
    if (this.textures.size <= this.maxTextures) return;
    const entries = [...this.textures.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [key, entry] of entries.slice(0, this.textures.size - this.maxTextures)) {
      this.gl.deleteTexture(entry.texture);
      this.textures.delete(key);
    }
  }

  private clearTextures(): void {
    for (const entry of this.textures.values()) this.gl.deleteTexture(entry.texture);
    this.textures.clear();
    this.inFlight.clear();
    this.failedTiles.clear();
    this.failureReported = false;
    this.pixelValueOverlay.invalidate();
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
