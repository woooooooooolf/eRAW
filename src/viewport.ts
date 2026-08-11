import { renderTile } from "./api";
import { backendErrorCode } from "./backend-error";
import {
  channelTint,
  type ChannelRenderingMode,
} from "./channel-rendering";
import { effectiveDemosaicDisplayExposure } from "./display-exposure";
import {
  drawViewportBackground,
  renderPreviewCanvas,
  type PreviewCaptureSnapshot,
} from "./image-capture";
import { t, type MessageKey } from "./i18n";
import {
  hexColorToUnitRgb,
  missingPixelPatternIndex,
  type MissingPixelAppearance,
} from "./missing-pixel-rendering";
import { PixelValueOverlay } from "./pixel-overlay";
import { hasExceededRoiDragThreshold } from "./roi-selection";
import {
  DEFAULT_PROCESSING_SETTINGS,
  type DemosaicPixelValueMode,
  type DisplayMode,
  type DocumentInfo,
  type ProcessingSettings,
  type TileRequest,
} from "./types";
import { ViewportOverlayLayer } from "./viewport-overlay";
import {
  snapCoordinateToPhysicalPixels,
  ViewportTransform,
  type ImagePoint,
  type ImageRect,
} from "./viewport-transform";

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

export interface TileTimingStats {
  samples: number;
  lastMs: number;
  averageMs: number;
  maxMs: number;
}

export interface ViewportCallbacks {
  onZoomChange(zoom: number): void;
  onSampleChange(sample: ImagePoint | null): void;
  onRenderStats(levelLabel: string, loaded: number, pending: number, timing: TileTimingStats): void;
  onSelectionChange(selection: ImageRect | null): void;
  onError(error: unknown, messageKey: MessageKey, scope: ViewportDiagnosticScope): void;
  onDiagnosticClear(scope: ViewportDiagnosticScope): void;
}

export type ViewportDiagnosticScope = "render" | "pixel" | "webgl";

const vertexShaderSource = `#version 300 es
in vec2 a_position;
uniform vec4 u_rect;
uniform vec2 u_viewport;
uniform vec2 u_camera;
uniform float u_zoom;
out vec2 v_image_point;
void main() {
  vec2 imagePoint = u_rect.xy + a_position * u_rect.zw;
  vec2 screenPoint = u_camera + imagePoint * u_zoom;
  vec2 clip = vec2(screenPoint.x / u_viewport.x * 2.0 - 1.0, 1.0 - screenPoint.y / u_viewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_image_point = imagePoint;
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform vec4 u_rect;
uniform float u_opacity;
uniform vec3 u_channel_tint;
uniform float u_demosaic_exposure;
uniform int u_missing_pattern;
uniform vec3 u_missing_color;
in vec2 v_image_point;
out vec4 outColor;
void main() {
  ivec2 texture_size = textureSize(u_texture, 0);
  vec2 local = (v_image_point - u_rect.xy) / u_rect.zw;
  ivec2 texel = clamp(ivec2(floor(local * vec2(texture_size))), ivec2(0), texture_size - 1);
  vec4 color = texelFetch(u_texture, texel, 0);
  bool missing = abs(color.a - 254.0 / 255.0) < 0.25 / 255.0;
  if (missing) {
    vec2 texel_span = u_rect.zw / vec2(texture_size);
    ivec2 image_texel = ivec2(floor(v_image_point / texel_span));
    ivec2 checker_cell = image_texel / 12;
    bool light_square = ((checker_cell.x + checker_cell.y) % 2) == 0;
    vec3 dark_checker = light_square
      ? vec3(73.0, 81.0, 92.0) / 255.0
      : vec3(41.0, 47.0, 55.0) / 255.0;
    vec3 light_checker = light_square
      ? vec3(232.0, 236.0, 241.0) / 255.0
      : vec3(198.0, 204.0, 212.0) / 255.0;
    vec3 missing_color = u_missing_pattern == 0
      ? dark_checker
      : (u_missing_pattern == 1 ? light_checker : u_missing_color);
    outColor = vec4(missing_color, u_opacity);
    return;
  }
  float spread = max(max(abs(color.r - color.g), abs(color.g - color.b)), abs(color.r - color.b));
  vec3 tinted = mix(color.rgb * u_channel_tint, color.rgb, step(0.5 / 255.0, spread));
  vec3 exposed = clamp(tinted * exp2(u_demosaic_exposure), 0.0, 1.0);
  outColor = vec4(exposed, color.a * u_opacity);
}`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(t("error.shaderCreate"));
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(t("error.shaderCompile", { detail: log ?? t("common.unknownError") }));
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error(t("error.programCreate"));
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(t("error.programLink", { detail: gl.getProgramInfoLog(program) ?? t("common.unknownError") }));
  }
  return program;
}

export class RawViewport {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly pixelCanvas: HTMLCanvasElement;
  private readonly pixelValueOverlay: PixelValueOverlay;
  private readonly gl: WebGL2RenderingContext;
  private readonly callbacks: ViewportCallbacks;
  private program!: WebGLProgram;
  private rectLocation!: WebGLUniformLocation;
  private viewportLocation!: WebGLUniformLocation;
  private cameraLocation!: WebGLUniformLocation;
  private zoomLocation!: WebGLUniformLocation;
  private opacityLocation!: WebGLUniformLocation;
  private channelTintLocation!: WebGLUniformLocation;
  private demosaicExposureLocation!: WebGLUniformLocation;
  private missingPatternLocation!: WebGLUniformLocation;
  private missingColorLocation!: WebGLUniformLocation;
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
  private inFlight = new Map<string, number>();
  private failedTiles = new Set<string>();
  private failureReported = false;
  private fitScale = 1;
  private width = 1;
  private height = 1;
  private dragging = false;
  private selecting = false;
  private selectionBeforeInteraction: ImageRect | null = null;
  private selectionPointerId: number | null = null;
  private selectionStartClient: ImagePoint | null = null;
  private selectionStartImage: ImagePoint | null = null;
  private selectionContextMenuAlreadySuppressed = false;
  private suppressContextMenuUntil = 0;
  private interactionMode: "pan" | "select" = "pan";
  private dragX = 0;
  private dragY = 0;
  private dragCameraX = 0;
  private dragCameraY = 0;
  private maxTextures = DEFAULT_MAX_TEXTURES;
  private wheelSensitivity = 0.0015;
  private channelRendering: ChannelRenderingMode = "color";
  private demosaicDisplayExposure = 0;
  private missingPixelAppearance: MissingPixelAppearance = {
    pattern: "darkCheckerboard",
    color: "#808080",
  };
  private animationFrame = 0;
  private contextLost = false;
  private lastSampleKey = "";
  private renderCounter = 0;
  private renderRevision = 1;
  private lodPlanKey = "";
  private structuralLodLevel: number | null = null;
  private timingSamples = 0;
  private timingTotalMs = 0;
  private timingLastMs = 0;
  private timingMaxMs = 0;

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
    this.pixelCanvas = container.querySelector<HTMLCanvasElement>(".pixel-value-overlay")!;
    this.pixelValueOverlay = new PixelValueOverlay(
      this.pixelCanvas,
      {
        onError: (error, messageKey) => this.callbacks.onError(error, messageKey, "pixel"),
        onRecovery: () => this.callbacks.onDiagnosticClear("pixel"),
        requestDraw: () => this.requestDraw(),
      },
    );
    const gl = this.canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error(t("error.webglUnsupported"));
    this.gl = gl;
    this.horizontalScrollbar = container.querySelector<HTMLElement>(".image-scrollbar.horizontal")!;
    this.horizontalThumb = this.horizontalScrollbar.querySelector<HTMLElement>(".scroll-thumb")!;
    this.verticalScrollbar = container.querySelector<HTMLElement>(".image-scrollbar.vertical")!;
    this.verticalThumb = this.verticalScrollbar.querySelector<HTMLElement>(".scroll-thumb")!;
    this.crosshair = container.querySelector<HTMLElement>(".canvas-crosshair")!;
    this.overlayLayer = new ViewportOverlayLayer(
      container.querySelector<SVGSVGElement>(".image-boundary")!,
      container.querySelector<HTMLElement>(".image-selection-overlay")!,
    );
    this.initializeGl();
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  private requireUniform(program: WebGLProgram, name: string): WebGLUniformLocation {
    const location = this.gl.getUniformLocation(program, name);
    if (!location) throw new Error(t("error.uniformUnavailable", { name }));
    return location;
  }

  private initializeGl(): void {
    const { gl } = this;
    this.program = createProgram(gl);
    this.rectLocation = this.requireUniform(this.program, "u_rect");
    this.viewportLocation = this.requireUniform(this.program, "u_viewport");
    this.cameraLocation = this.requireUniform(this.program, "u_camera");
    this.zoomLocation = this.requireUniform(this.program, "u_zoom");
    this.opacityLocation = this.requireUniform(this.program, "u_opacity");
    this.channelTintLocation = this.requireUniform(this.program, "u_channel_tint");
    this.demosaicExposureLocation = this.requireUniform(this.program, "u_demosaic_exposure");
    this.missingPatternLocation = this.requireUniform(this.program, "u_missing_pattern");
    this.missingColorLocation = this.requireUniform(this.program, "u_missing_color");
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error(t("error.bufferAllocation"));
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
    this.canvas.addEventListener("webglcontextlost", (event) => this.onContextLost(event as WebGLContextEvent));
    this.canvas.addEventListener("webglcontextrestored", () => this.onContextRestored());
    this.canvas.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
    this.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    this.canvas.addEventListener("pointercancel", (event) => this.onPointerCancel(event));
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
      this.alignCameraAtActualSize();
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
    if (dimensionsChanged) {
      this.overlayLayer.clearSelection();
      this.callbacks.onSelectionChange(null);
    }
    this.updatePointerPosition(null);
    this.frame = Math.min(this.frame, Math.max(0, document.layout.frameCount - 1));
    this.clearTextures();
    if (!preserveView || dimensionsChanged) this.fit(); else this.requestDraw();
  }

  clearDocument(): void {
    this.abortSelectionGesture();
    this.document = null;
    this.frame = 0;
    this.zoom = 1;
    this.cameraX = 0;
    this.cameraY = 0;
    this.fitScale = 1;
    this.interactionMode = "pan";
    this.dragging = false;
    this.canvas.classList.remove("dragging");
    this.hideCrosshair();
    this.overlayLayer.clearSelection();
    this.callbacks.onSelectionChange(null);
    this.overlayLayer.hide();
    this.lastSampleKey = "";
    this.clearTextures();
    this.callbacks.onSampleChange(null);
    this.callbacks.onZoomChange(this.zoom);
    this.callbacks.onRenderStats("L0", 0, 0, {
      samples: 0,
      lastMs: 0,
      averageMs: 0,
      maxMs: 0,
    });
    this.requestDraw();
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

  setChannelRendering(mode: ChannelRenderingMode): void {
    if (mode === this.channelRendering) return;
    this.channelRendering = mode;
    this.requestDraw();
  }

  setDemosaicDisplayExposure(exposure: number): void {
    if (exposure === this.demosaicDisplayExposure) return;
    this.demosaicDisplayExposure = exposure;
    this.requestDraw();
  }

  setMissingPixelAppearance(appearance: MissingPixelAppearance): void {
    if (
      appearance.pattern === this.missingPixelAppearance.pattern
      && appearance.color === this.missingPixelAppearance.color
    ) return;
    this.missingPixelAppearance = { ...appearance };
    this.requestDraw();
  }

  captureCurrentView(): HTMLCanvasElement {
    if (!this.document) throw new Error("document_not_open");
    this.draw();
    const width = this.canvas.width;
    const height = this.canvas.height;
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const context = output.getContext("2d", { alpha: true });
    if (!context) throw new Error("capture_canvas_unavailable");
    const computed = getComputedStyle(this.container);
    drawViewportBackground(
      context,
      width,
      height,
      this.width,
      this.height,
      {
        surface: computed.getPropertyValue("--viewport-surface").trim() || computed.backgroundColor,
        pattern: computed.getPropertyValue("--viewport-pattern").trim() || "transparent",
        glow: computed.getPropertyValue("--viewport-glow").trim() || "transparent",
      },
    );

    const pixels = new Uint8Array(width * height * 4);
    this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
    const rowBytes = width * 4;
    const flipped = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < height; y += 1) {
      const source = (height - 1 - y) * rowBytes;
      flipped.set(pixels.subarray(source, source + rowBytes), y * rowBytes);
    }
    const rawLayer = document.createElement("canvas");
    rawLayer.width = width;
    rawLayer.height = height;
    const rawContext = rawLayer.getContext("2d");
    if (!rawContext) throw new Error("capture_canvas_unavailable");
    rawContext.putImageData(new ImageData(flipped, width, height), 0, 0);
    context.drawImage(rawLayer, 0, 0);
    context.drawImage(this.pixelCanvas, 0, 0, width, height);
    this.drawCaptureOverlays(context, width / this.width, height / this.height);
    return output;
  }

  captureFullPreview(): Promise<HTMLCanvasElement> {
    return renderPreviewCanvas(this.captureSnapshot());
  }

  private captureSnapshot(): PreviewCaptureSnapshot {
    if (!this.document) throw new Error("document_not_open");
    return {
      generation: this.document.generation,
      renderRevision: this.renderRevision,
      frame: this.frame,
      imageWidth: this.document.descriptor.width,
      imageHeight: this.document.descriptor.height,
      mode: this.settings.mode,
      processing: {
        ...this.settings.processing,
        remosaic: { ...this.settings.processing.remosaic },
      },
      displayMin: this.settings.displayMin,
      displayMax: this.settings.displayMax,
      channelRendering: this.channelRendering,
      demosaicDisplayExposure: this.demosaicDisplayExposure,
      missingPixelAppearance: { ...this.missingPixelAppearance },
    };
  }

  private drawCaptureOverlays(
    context: CanvasRenderingContext2D,
    scaleX: number,
    scaleY: number,
  ): void {
    context.save();
    context.scale(scaleX, scaleY);
    const svg = this.container.querySelector<SVGSVGElement>(".image-boundary");
    if (svg?.classList.contains("visible")) {
      svg.querySelectorAll<SVGRectElement>("rect").forEach((rect) => {
        const style = getComputedStyle(rect);
        const x = Number(rect.getAttribute("x") ?? 0);
        const y = Number(rect.getAttribute("y") ?? 0);
        const width = Number(rect.getAttribute("width") ?? 0);
        const height = Number(rect.getAttribute("height") ?? 0);
        if (style.fill && style.fill !== "none" && style.fill !== "rgba(0, 0, 0, 0)") {
          context.fillStyle = style.fill;
          context.fillRect(x, y, width, height);
        }
        if (style.stroke && style.stroke !== "none") {
          context.strokeStyle = style.stroke;
          context.lineWidth = Number.parseFloat(style.strokeWidth) || 1;
          const dash = style.strokeDasharray
            .split(/[,\s]+/)
            .map(Number)
            .filter((value) => Number.isFinite(value) && value > 0);
          context.setLineDash(dash);
          context.strokeRect(x, y, width, height);
          context.setLineDash([]);
        }
      });
    }

    const selection = this.container.querySelector<HTMLElement>(".image-selection-overlay.visible");
    if (selection) {
      const style = getComputedStyle(selection);
      const x = Number.parseFloat(selection.style.left);
      const y = Number.parseFloat(selection.style.top);
      const width = Number.parseFloat(selection.style.width);
      const height = Number.parseFloat(selection.style.height);
      if ([x, y, width, height].every(Number.isFinite)) {
        context.fillStyle = style.backgroundColor;
        context.fillRect(x, y, width, height);
        const strokes: Array<{ color: string; width: number; dash?: number[] }> = [
          { color: "rgba(255,255,255,.9)", width: 7 },
          { color: "rgba(0,0,0,.92)", width: 5 },
          { color: style.borderColor, width: 3, dash: [8, 4] },
        ];
        for (const stroke of strokes) {
          context.strokeStyle = stroke.color;
          context.lineWidth = stroke.width;
          context.setLineDash(stroke.dash ?? []);
          context.strokeRect(x, y, width, height);
        }
        context.setLineDash([]);
      }
    }

    if (this.crosshair.classList.contains("visible")) {
      const x = Number.parseFloat(this.crosshair.style.getPropertyValue("--crosshair-x"));
      const y = Number.parseFloat(this.crosshair.style.getPropertyValue("--crosshair-y"));
      const line = this.crosshair.querySelector<HTMLElement>(".crosshair-horizontal");
      context.strokeStyle = line ? getComputedStyle(line).backgroundColor : "rgba(255,255,255,.35)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(this.width, y);
      context.moveTo(x, 0);
      context.lineTo(x, this.height);
      context.stroke();
    }

    const containerRect = this.container.getBoundingClientRect();
    this.container.querySelectorAll<HTMLElement>(".image-scrollbar.visible .scroll-thumb").forEach((thumb) => {
      const rect = thumb.getBoundingClientRect();
      const style = getComputedStyle(thumb);
      context.fillStyle = style.backgroundColor;
      context.strokeStyle = style.borderColor;
      context.lineWidth = Number.parseFloat(style.borderWidth) || 1;
      context.beginPath();
      context.roundRect(
        rect.left - containerRect.left,
        rect.top - containerRect.top,
        rect.width,
        rect.height,
        Number.parseFloat(style.borderRadius) || 0,
      );
      context.fill();
      context.stroke();
    });
    context.restore();
  }

  setPixelInspectionPreferences(preferences: {
    enabled: boolean;
    gridColor: string;
    demosaicValues: DemosaicPixelValueMode;
  }): void {
    this.pixelValueOverlay.setPreferences(preferences);
  }

  setInteractionMode(mode: "pan" | "select"): void {
    this.abortSelectionGesture();
    this.interactionMode = mode;
    this.dragging = false;
    this.canvas.classList.remove("dragging");
  }

  private onContextLost(event: WebGLContextEvent): void {
    event.preventDefault();
    this.contextLost = true;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.textures.clear();
    this.inFlight.clear();
    this.failedTiles.clear();
    this.failureReported = false;
    this.advanceRenderRevision();
    this.pixelValueOverlay.invalidate();
    this.callbacks.onDiagnosticClear("render");
    this.callbacks.onError(new Error(t("runtime.webglContextLost")), "runtime.webglContextLost", "webgl");
  }

  private onContextRestored(): void {
    try {
      this.initializeGl();
      this.contextLost = false;
      this.callbacks.onDiagnosticClear("webgl");
      this.resize();
      this.requestDraw();
    } catch (error) {
      this.callbacks.onError(error, "runtime.webglRestoreFailed", "webgl");
    }
  }

  getInteractionMode(): "pan" | "select" {
    return this.interactionMode;
  }

  getSelection(): ImageRect | null {
    return this.overlayLayer.selection.rect;
  }

  setSelection(rect: ImageRect): void {
    this.overlayLayer.setSelection(rect);
    this.callbacks.onSelectionChange(rect);
    this.requestDraw();
  }

  clearSelection(): void {
    this.overlayLayer.clearSelection();
    this.callbacks.onSelectionChange(null);
    this.requestDraw();
  }

  setSelectionVisible(visible: boolean): void {
    this.overlayLayer.setSelectionVisible(visible);
    this.requestDraw();
  }

  cancelSelection(): boolean {
    if (this.selectionPointerId === null) return false;
    this.abortSelectionGesture();
    this.requestDraw();
    return true;
  }

  consumeContextMenuSuppression(): boolean {
    if (this.selecting) {
      this.selectionContextMenuAlreadySuppressed = true;
      return true;
    }
    if (performance.now() > this.suppressContextMenuUntil) return false;
    this.suppressContextMenuUntil = 0;
    return true;
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
    this.alignCameraAtActualSize();
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
    this.alignCameraAtActualSize();
    this.constrainCamera();
    this.callbacks.onZoomChange(this.zoom);
    this.requestDraw();
  }

  private resize(): void {
    const previousWidth = this.width;
    const previousHeight = this.height;
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    if (this.document) {
      this.transform.preserveViewportCenter(
        previousWidth,
        previousHeight,
        this.width,
        this.height,
      );
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(this.width * dpr);
    const pixelHeight = Math.round(this.height * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
    }
    this.alignCameraAtActualSize();
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
    this.alignCameraAtActualSize();
    this.constrainCamera();
    this.updatePointerPosition(this.updateCrosshair(event));
    this.callbacks.onZoomChange(this.zoom);
    this.requestDraw();
  }

  private onPointerDown(event: PointerEvent): void {
    if (!this.document) return;
    const point = this.eventPoint(event);
    if (this.interactionMode === "select" && event.button === 2) {
      this.selectionBeforeInteraction = this.overlayLayer.selection.rect;
      this.selectionPointerId = event.pointerId;
      this.selectionStartClient = { x: event.clientX, y: event.clientY };
      this.selectionStartImage = this.transform.screenToImage(point);
      this.selectionContextMenuAlreadySuppressed = false;
      this.canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
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
    if (
      this.selectionPointerId === event.pointerId
      && this.selectionStartClient
      && this.selectionStartImage
    ) {
      if (!this.selecting && hasExceededRoiDragThreshold(
        this.selectionStartClient,
        { x: event.clientX, y: event.clientY },
      )) {
        this.selecting = true;
        this.overlayLayer.beginSelection(
          this.selectionStartImage,
          this.document.descriptor.width,
          this.document.descriptor.height,
        );
        this.canvas.classList.add("selecting");
      }
      if (!this.selecting) return;
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
      this.alignCameraAtActualSize();
      this.updateCrosshair(event);
      this.requestDraw();
      return;
    }
    this.updatePointerPosition(this.updateCrosshair(event));
  }

  private onPointerUp(event: PointerEvent): void {
    if (this.selectionPointerId === event.pointerId) {
      const completedSelection = this.selecting;
      if (completedSelection) {
        this.overlayLayer.endSelection();
        this.callbacks.onSelectionChange(this.overlayLayer.selection.rect);
        if (!this.selectionContextMenuAlreadySuppressed) {
          this.suppressContextMenuUntil = performance.now() + 750;
        }
      }
      this.finishSelectionGesture(event.pointerId);
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

  private onPointerCancel(event: PointerEvent): void {
    if (this.selectionPointerId === event.pointerId) {
      this.abortSelectionGesture();
      return;
    }
    if (!this.dragging) return;
    this.dragging = false;
    this.canvas.classList.remove("dragging");
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  }

  private finishSelectionGesture(pointerId: number): void {
    this.selecting = false;
    this.selectionBeforeInteraction = null;
    this.selectionPointerId = null;
    this.selectionStartClient = null;
    this.selectionStartImage = null;
    this.selectionContextMenuAlreadySuppressed = false;
    this.canvas.classList.remove("selecting");
    if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
  }

  private abortSelectionGesture(): void {
    const pointerId = this.selectionPointerId;
    if (this.selecting) this.overlayLayer.setSelection(this.selectionBeforeInteraction);
    this.selecting = false;
    this.selectionBeforeInteraction = null;
    this.selectionPointerId = null;
    this.selectionStartClient = null;
    this.selectionStartImage = null;
    this.selectionContextMenuAlreadySuppressed = false;
    this.canvas.classList.remove("selecting");
    if (pointerId !== null && this.canvas.hasPointerCapture(pointerId)) {
      this.canvas.releasePointerCapture(pointerId);
    }
    this.requestDraw();
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
    this.cameraX = snapCoordinateToPhysicalPixels(this.cameraX, this.width, this.canvas.width);
    this.cameraY = snapCoordinateToPhysicalPixels(this.cameraY, this.height, this.canvas.height);
  }

  private alignCameraAtActualSize(): void {
    if (Math.abs(this.zoom - 1) < 1e-9) this.snapCameraToPhysicalPixels();
  }

  private requestDraw(): void {
    if (this.contextLost || this.animationFrame) return;
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

  private usesStructuralLod(): boolean {
    return Boolean(
      this.document
      && this.document.descriptor.cfa !== "MONO"
      && ["raw", "bayer", "remosaic"].includes(this.settings.mode),
    );
  }

  private lodPlan(): LodPlan {
    const maxLevel = this.maximumLevel();
    if (!this.document || this.zoom >= 1 || maxLevel === 0) {
      if (this.usesStructuralLod()) this.structuralLodLevel = 0;
      return { fineLevel: 0, coarseLevel: null, blend: 0 };
    }
    const ideal = Math.max(0, Math.min(maxLevel, Math.log2(1 / this.zoom)));
    if (this.usesStructuralLod()) {
      // Cross-fading two differently sized CFA grids visually mixes their
      // sites, so structural previews switch one complete level at a time.
      let level = this.structuralLodLevel === null
        ? Math.round(ideal)
        : Math.max(0, Math.min(maxLevel, this.structuralLodLevel));
      const hysteresis = 0.08;
      while (level < maxLevel && ideal > level + 0.5 + hysteresis) level += 1;
      while (level > 0 && ideal < level - 0.5 - hysteresis) level -= 1;
      this.structuralLodLevel = level;
      return { fineLevel: level, coarseLevel: null, blend: 0 };
    }
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
    if (this.contextLost) return;
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
    this.updateLodRevision(plan);
    const fineVisible = this.visibleTiles(plan.fineLevel);
    const coarseVisible = plan.coarseLevel === null ? [] : this.visibleTiles(plan.coarseLevel);
    gl.useProgram(this.program);
    gl.uniform2f(this.viewportLocation, this.width, this.height);
    gl.uniform2f(this.cameraLocation, this.cameraX, this.cameraY);
    gl.uniform1f(this.zoomLocation, this.zoom);
    const tint = channelTint(this.settings.mode, this.channelRendering);
    gl.uniform3f(this.channelTintLocation, tint[0], tint[1], tint[2]);
    gl.uniform1f(
      this.demosaicExposureLocation,
      effectiveDemosaicDisplayExposure(this.settings.mode, this.demosaicDisplayExposure),
    );
    gl.uniform1i(
      this.missingPatternLocation,
      missingPixelPatternIndex(this.missingPixelAppearance.pattern),
    );
    const missingColor = hexColorToUnitRgb(this.missingPixelAppearance.color);
    gl.uniform3f(
      this.missingColorLocation,
      missingColor[0],
      missingColor[1],
      missingColor[2],
    );
    const fineLoaded = this.drawLayer(plan.fineLevel, fineVisible, 1);
    const coarseLoaded = plan.coarseLevel === null
      ? 0
      : this.drawLayer(plan.coarseLevel, coarseVisible, plan.blend);
    this.updateScrollbars();
    const levelLabel = plan.coarseLevel === null
      ? `L${plan.fineLevel}`
      : `L${plan.fineLevel}↔L${plan.coarseLevel}`;
    const visibleKeys = new Set([
      ...fineVisible.map((tile) => this.tileKey(plan.fineLevel, tile.x, tile.y)),
      ...coarseVisible.map((tile) => this.tileKey(plan.coarseLevel!, tile.x, tile.y)),
    ]);
    const pending = [...this.inFlight.entries()].filter(
      ([key, revision]) => revision === this.renderRevision && visibleKeys.has(key),
    ).length;
    this.callbacks.onRenderStats(levelLabel, fineLoaded + coarseLoaded, pending, {
      samples: this.timingSamples,
      lastMs: this.timingLastMs,
      averageMs: this.timingSamples ? this.timingTotalMs / this.timingSamples : 0,
      maxMs: this.timingMaxMs,
    });
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
    const revision = this.renderRevision;
    const startedAt = performance.now();
    this.inFlight.set(key, revision);
    const request: TileRequest = {
      generation: this.document.generation,
      renderRevision: revision,
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
      if (!this.document || revision !== this.renderRevision || key !== this.tileKey(level, tileX, tileY)) return;
      const texture = this.gl.createTexture();
      if (!texture) throw new Error(t("error.textureAllocation"));
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, TILE_SIZE, TILE_SIZE, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, bytes);
      this.textures.set(key, { texture, level, tileX, tileY, lastUsed: ++this.renderCounter });
      this.recordTileTiming(performance.now() - startedAt);
      this.evictTextures();
    }).catch((error: unknown) => {
      const code = backendErrorCode(error);
      const belongsToCurrentView = this.document && key === this.tileKey(level, tileX, tileY);
      if (code !== "stale_generation" && code !== "stale_render" && belongsToCurrentView) {
        this.failedTiles.add(key);
        if (!this.failureReported) {
          this.failureReported = true;
          this.callbacks.onError(error, "runtime.renderFailed", "render");
        }
      }
    }).finally(() => {
      if (this.inFlight.get(key) === revision) this.inFlight.delete(key);
      this.requestDraw();
    });
  }

  private updateLodRevision(plan: LodPlan): void {
    const key = `${plan.fineLevel}:${plan.coarseLevel ?? "-"}`;
    if (!this.lodPlanKey) {
      this.lodPlanKey = key;
      return;
    }
    if (key === this.lodPlanKey) return;
    this.lodPlanKey = key;
    this.advanceRenderRevision();
  }

  private advanceRenderRevision(): void {
    this.renderRevision += 1;
    this.inFlight.clear();
    this.timingSamples = 0;
    this.timingTotalMs = 0;
    this.timingLastMs = 0;
    this.timingMaxMs = 0;
  }

  private recordTileTiming(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    this.timingSamples += 1;
    this.timingTotalMs += durationMs;
    this.timingLastMs = durationMs;
    this.timingMaxMs = Math.max(this.timingMaxMs, durationMs);
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
    if (!this.contextLost) {
      for (const entry of this.textures.values()) this.gl.deleteTexture(entry.texture);
    }
    this.textures.clear();
    this.advanceRenderRevision();
    this.lodPlanKey = "";
    this.structuralLodLevel = null;
    this.failedTiles.clear();
    this.failureReported = false;
    this.callbacks.onDiagnosticClear("render");
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
