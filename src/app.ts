import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import erawIconUrl from "./assets/eraw-icon.svg";
import {
  analyzeRawImage,
  cancelRawAnalysis,
  choosePngFile,
  chooseRawFile,
  closeDocument,
  openDocument,
  updateDescriptor,
} from "./api";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  parseAppSettings,
  type AppSettings,
  type OpenView,
  type SidebarPosition,
  type TileCache,
  type UiFontSize,
  type WheelSpeed,
} from "./app-settings";
import { backendErrorCode, localizeBackendError } from "./backend-error";
import type { ChannelRenderingMode } from "./channel-rendering";
import { normalizeIntegerInput } from "./descriptor-input";
import { ExportDialog, exportDialogTemplate } from "./export-dialog";
import { packingControlState } from "./packing-controls";
import {
  formatDateTime,
  formatTime,
  getLanguageOptions,
  getLanguagePreference,
  getLocaleName,
  getResolvedLocale,
  isLanguagePreference,
  localizeTree,
  refreshLocalizedTree,
  setLanguagePreference,
  t,
  type LanguagePreference,
  type MessageKey,
} from "./i18n";
import {
  normalizeMissingPixelColor,
  type MissingPixelPattern,
} from "./missing-pixel-rendering";
import { copyCanvasImage, saveCanvasPng } from "./image-output";
import { normalizePixelGridColor } from "./pixel-grid-rendering";
import {
  THEMES,
  isAppTheme,
  themeMessageKey,
  type AppTheme,
} from "./theme-catalog";
import { RawViewport, type ImagePoint, type TileTimingStats } from "./viewport";
import {
  StatisticsPanel,
  type StatisticsPanelAction,
  type StatisticsPanelState,
  type StatisticsWindowActionMessage,
} from "./statistics-panel";
import type {
  AnalysisResult,
  BitAlignment,
  CfaPattern,
  DemosaicPixelValueMode,
  DisplayMode,
  DocumentInfo,
  Endianness,
  ExportTarget,
  Packing,
  ProcessingSettings,
  RawDescriptor,
} from "./types";
import type { ImageRect } from "./viewport-transform";
import {
  DEFAULT_DESCRIPTOR,
  DEFAULT_PROCESSING_SETTINGS,
  isColorCfa,
  isQuadCfa,
} from "./types";

const VERSION = "0.3.3";
const BUILD_TIME_SOURCE = __ERAW_BUILD_TIME__;
const STORAGE_KEY = "eraw.rawDescriptor.v1";
const SETTINGS_KEY = "eraw.appSettings.v1";
const PROCESSING_KEY = "eraw.processingSettings.v1";
const STATISTICS_PRESENTATION_KEY = "eraw.statisticsPresentation.v1";

interface RuntimeDiagnostic {
  source: unknown;
  messageKey?: MessageKey;
  fingerprint: string;
  count: number;
  timestamp: Date;
}

const MAX_IMAGE_DIMENSION = 100_000;

const WARNING_MESSAGES: Record<string, MessageKey> = {
  empty_dimensions: "warning.emptyDimensions",
  invalid_bit_depth: "warning.invalidBitDepth",
  container_too_small: "warning.containerTooSmall",
  packing_depth_mismatch: "warning.packingDepthMismatch",
  short_row_stride: "warning.shortRowStride",
  short_frame_stride: "warning.shortFrameStride",
  header_outside_file: "warning.headerOutside",
  no_decodable_frame: "warning.noFrame",
  partial_first_frame: "warning.partialFirst",
  partial_last_frame: "warning.partialLast",
  multiple_frames: "warning.multipleFrames",
};

function icon(path: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
}

const icons = {
  open: icon("M4 5h6l2 2h8a2 2 0 0 1 2 2v1H7.2L4 17.4V5Zm18 7-4 8H2l4-8h16Z"),
  closeFile: icon("M5 3h9l5 5v4h-2V9h-4V5H7v14h5v2H5V3Zm10.4 10 2.1 2.1 2.1-2.1 1.4 1.4-2.1 2.1 2.1 2.1-1.4 1.4-2.1-2.1-2.1 2.1-1.4-1.4 2.1-2.1-2.1-2.1 1.4-1.4Z"),
  export: icon("M13 3v8.2l2.6-2.6L17 10l-5 5-5-5 1.4-1.4 2.6 2.6V3h2Zm-9 14h2v2h12v-2h2v4H4v-4Z"),
  fit: icon("M4 9V4h5v2H6v3H4Zm11-5h5v5h-2V6h-3V4ZM4 15h2v3h3v2H4v-5Zm14 0h2v5h-5v-2h3v-3Z"),
  actual: icon("M4 4h16v16H4V4Zm2 2v12h12V6H6Zm2 2h2v2H8V8Zm6 6h2v2h-2v-2Z"),
  settings: icon("M19.4 13a7.9 7.9 0 0 0 .1-1 7.9 7.9 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7.3 7.3 0 0 0-1.7-1L15 3.3h-4L10.7 6A7.3 7.3 0 0 0 9 7L6.5 6l-2 3.4L6.6 11a7.9 7.9 0 0 0-.1 1 7.9 7.9 0 0 0 .1 1l-2.1 1.6 2 3.4L9 17a7.3 7.3 0 0 0 1.7 1l.3 2.7h4l.3-2.7a7.3 7.3 0 0 0 1.7-1l2.5 1 2-3.4L19.4 13ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"),
  theme: icon("M12 3a9 9 0 0 0 0 18h1.2a2.3 2.3 0 0 0 1.6-4l-.4-.4a1.2 1.2 0 0 1 .9-2h1.8A3.9 3.9 0 0 0 21 10.7C21 6.5 17 3 12 3Zm-4 9.2a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Zm1.5-4.4a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Zm4.3-.7a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Zm3 3a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z"),
  language: icon("M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 9h-3.1a15.7 15.7 0 0 0-1.4-5A8.1 8.1 0 0 1 18.9 11ZM12 4c1 1.2 1.7 3.7 1.8 7H10.2C10.3 7.7 11 5.2 12 4ZM9.6 6a15.7 15.7 0 0 0-1.4 5H5.1A8.1 8.1 0 0 1 9.6 6ZM5.1 13h3.1a15.7 15.7 0 0 0 1.4 5A8.1 8.1 0 0 1 5.1 13Zm6.9 7c-1-1.2-1.7-3.7-1.8-7h3.6c-.1 3.3-.8 5.8-1.8 7Zm2.4-2a15.7 15.7 0 0 0 1.4-5h3.1a8.1 8.1 0 0 1-4.5 5Z"),
  about: icon("M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-1 7h2v6h-2v-6Zm0-4h2v2h-2V7Z"),
  panel: icon("M3 4h18v16H3V4Zm2 2v12h4V6H5Zm6 0v12h8V6h-8Z"),
  warning: icon("M12 3 2 21h20L12 3Zm0 4 6.6 12H5.4L12 7Zm-1 3v5h2v-5h-2Zm0 6.5v2h2v-2h-2Z"),
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

function descriptorsEqual(left: RawDescriptor, right: RawDescriptor): boolean {
  return (Object.keys(DEFAULT_DESCRIPTOR) as Array<keyof RawDescriptor>).every((key) => left[key] === right[key]);
}

function clampImageDimension(value: number): number {
  return Math.max(1, Math.min(MAX_IMAGE_DIMENSION, Number.isFinite(value) ? Math.trunc(value) : 1));
}

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return parseAppSettings(JSON.parse(saved));
  } catch { /* 使用安全默认值 */ }
  return { ...DEFAULT_SETTINGS };
}

function loadDescriptor(remember: boolean): RawDescriptor {
  if (!remember) return { ...DEFAULT_DESCRIPTOR };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const descriptor = { ...DEFAULT_DESCRIPTOR, ...JSON.parse(saved) as Partial<RawDescriptor> };
      descriptor.width = clampImageDimension(descriptor.width);
      descriptor.height = clampImageDimension(descriptor.height);
      return descriptor;
    }
  } catch { /* 使用安全默认值 */ }
  return { ...DEFAULT_DESCRIPTOR };
}

function loadProcessingSettings(): ProcessingSettings {
  try {
    const saved = localStorage.getItem(PROCESSING_KEY);
    if (saved) {
      const value = JSON.parse(saved) as Partial<ProcessingSettings>;
      return {
        demosaicAlgorithm: "bilinear",
        remosaic: {
          sameColorReconstruction:
            typeof value.remosaic?.sameColorReconstruction === "boolean"
              ? value.remosaic.sameColorReconstruction
              : DEFAULT_PROCESSING_SETTINGS.remosaic.sameColorReconstruction,
        },
      };
    }
  } catch { /* 使用安全默认值 */ }
  return {
    ...DEFAULT_PROCESSING_SETTINGS,
    remosaic: { ...DEFAULT_PROCESSING_SETTINGS.remosaic },
  };
}

export class ErawApp {
  private readonly root: HTMLElement;
  private readonly viewport: RawViewport;
  private readonly exportDialog: ExportDialog;
  private readonly statisticsPanel: StatisticsPanel;
  private settings = loadSettings();
  private descriptor = loadDescriptor(this.settings.rememberDescriptor);
  private processing = loadProcessingSettings();
  private document: DocumentInfo | null = null;
  private frame = 0;
  private displayMode: DisplayMode = "bayer";
  private committing = false;
  private commitRevision = 0;
  private fileOperationInProgress = false;
  private imageCaptureInProgress = false;
  private toastTimer = 0;
  private sidebarWidth = this.settings.sidebarWidth;
  private sidebarResizeStartX = 0;
  private sidebarResizeStartWidth = 0;
  private settingsFormSidebarWidth = this.settings.sidebarWidth;
  private runtimeDiagnostics: RuntimeDiagnostic[] = [];
  private lastSample: ImagePoint | null = null;
  private statisticsOpen = false;
  private statisticsDetached = localStorage.getItem(STATISTICS_PRESENTATION_KEY) === "detached";
  private statisticsUseSelection = false;
  private statisticsRevision = 0;
  private statisticsResult: AnalysisResult | null = null;
  private statisticsLoading = false;
  private statisticsError: string | null = null;
  private statisticsDockHeight = 330;
  private statisticsResizeStartY = 0;
  private statisticsResizeStartHeight = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    setLanguagePreference(this.settings.language);
    root.innerHTML = this.template();
    localizeTree(root);
    this.writeDescriptor(this.descriptor);
    this.updatePackingDependentUi();
    const normalizedBitDepth = Number(this.descriptorFieldValue("bitDepth"));
    if (normalizedBitDepth !== this.descriptor.bitDepth) {
      this.descriptor = { ...this.descriptor, bitDepth: normalizedBitDepth };
      if (this.settings.rememberDescriptor) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.descriptor));
      }
    }
    this.exportDialog = new ExportDialog(root, {
      onSuccess: (message) => this.showToast(message, "success", 6000),
    });
    this.viewport = new RawViewport(this.get("viewport"), {
      onZoomChange: (zoom) => this.updateZoomStatus(zoom),
      onSampleChange: (sample) => this.updateSample(sample),
      onRenderStats: (levelLabel, loaded, pending, timing) => {
        this.updateRenderStatus(levelLabel, loaded, pending, timing);
      },
      onSelectionChange: (selection) => this.onStatisticsSelectionChange(selection),
      onError: (error, messageKey) => this.reportRuntimeError(error, messageKey),
    });
    this.statisticsPanel = new StatisticsPanel(this.get("statistics-panel"), {
      detached: false,
      onAction: (action) => this.onStatisticsAction(action),
      onError: (error) => this.reportRuntimeError(error),
      onNotify: (message) => this.showToast(message, "success"),
    });
    this.get<HTMLInputElement>("processing-same-color-reconstruction").checked =
      this.processing.remosaic.sameColorReconstruction;
    this.applySettings();
    this.setLanguage(this.settings.language);
    this.bindEvents();
    if (isTauri()) void this.bindStatisticsWindowEvents();
    this.updateCfaDependentUi(false);
    this.updateDisplay();
    this.updateDocumentUi();
  }

  private get<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = this.root.querySelector<T>(`#${id}`);
    if (!element) throw new Error(t("error.elementMissing", { id }));
    return element;
  }

  private template(): string {
    return `
      <div class="app-shell">
        <header class="topbar">
          <div class="toolbar primary-actions">
            <button id="open-button" class="tool-button accent"><i class="file-action-icon file-action-open">${icons.open}</i><i class="file-action-icon file-action-close">${icons.closeFile}</i><span>打开</span><kbd>Ctrl O</kbd></button>
            <div id="export-control" class="export-control">
              <button id="export-button" class="tool-button" disabled aria-haspopup="menu" aria-expanded="false">${icons.export}<span>导出</span><kbd>Ctrl E</kbd></button>
              <div id="export-popover" class="export-popover" role="menu" aria-label="选择导出内容" hidden>
                <header><strong>导出当前帧</strong><span>冻结当前参数与处理设置</span></header>
                <button type="button" role="menuitem" data-export-target="originalCfa"><i>CFA</i><span><strong>原始 CFA</strong><small>Packing 转换、裁剪与有效像素提取</small></span><b>›</b></button>
                <button id="export-remosaic-item" type="button" role="menuitem" data-export-target="remosaic"><i>RM</i><span><strong>Remosaic Bayer</strong><small>按当前 Remosaic 设置输出标准 Bayer</small></span><b>›</b></button>
                <button id="export-demosaic-item" type="button" role="menuitem" data-export-target="demosaic"><i>RGB</i><span><strong>Demosaic RGB</strong><small>输出 RGB48 Interleaved RAW</small></span><b>›</b></button>
              </div>
            </div>
          </div>
          <div class="toolbar display-modes" role="group" aria-label="显示模式">
            <button data-mode="raw">RAW 强度</button>
            <button id="cfa-mode" class="active" data-mode="bayer">CFA 点阵</button>
            <button id="remosaic-mode" data-mode="remosaic" hidden>Remosaic</button>
            <div id="demosaic-group" class="demosaic-group" role="group" aria-label="Demosaic RGB 通道">
              <button id="demosaic-mode" data-mode="demosaic">Demosaic</button>
              <div class="channel-modes">
                <button type="button" data-mode="red" title="R 平面" aria-label="R 平面">R</button>
                <button type="button" data-mode="green" title="G 平面" aria-label="G 平面">G</button>
                <button type="button" data-mode="blue" title="B 平面" aria-label="B 平面">B</button>
              </div>
            </div>
          </div>
          <div class="toolbar view-actions">
            <button id="fit-button" class="icon-button" title="适应窗口 (Ctrl+0)">${icons.fit}</button>
            <button id="actual-button" class="icon-button" title="实际像素 (Ctrl+1)">${icons.actual}</button>
            <button id="panel-button" class="icon-button active" title="显示或隐藏参数面板">${icons.panel}</button>
            <div id="language-control" class="language-control">
              <button id="language-button" class="icon-button" title="${t("language.button")}" aria-label="${t("language.button")}" aria-haspopup="menu" aria-expanded="false">${icons.language}</button>
              <div id="language-popover" class="language-popover" role="menu" aria-label="${t("language.menuTitle")}" hidden>
                <header><strong>${t("language.menuTitle")}</strong><span>${t("language.menuHint")}</span></header>
                <div class="language-options">${getLanguageOptions().map((option) => `
                  <button type="button" role="menuitemradio" data-language-value="${option.value}" aria-checked="${option.value === getLanguagePreference()}">
                    <span>${option.label}</span><em aria-hidden="true">✓</em>
                  </button>`).join("")}
                </div>
              </div>
            </div>
            <div id="theme-control" class="theme-control">
              <button id="theme-button" class="icon-button" title="切换界面主题" aria-label="切换界面主题" aria-haspopup="menu" aria-expanded="false">${icons.theme}</button>
              <div id="theme-popover" class="theme-popover" role="menu" aria-label="选择界面主题" hidden>
                <header><strong>界面主题</strong><span>即时切换并自动保存</span></header>
                <div class="theme-options">${THEMES.map((theme) => `
                  <button type="button" role="menuitemradio" data-theme-value="${theme.id}" aria-checked="false">
                    <i class="theme-swatch" style="--swatch-bg:${theme.background};--swatch-surface:${theme.surface};--swatch-accent:${theme.accent}"><b></b><b></b><b></b></i>
                    <span><strong>${theme.name}</strong><small>${theme.tone}</small></span>
                    <em aria-hidden="true">✓</em>
                  </button>`).join("")}
                </div>
              </div>
            </div>
            <button id="settings-button" class="icon-button" title="设置">${icons.settings}</button>
            <div id="utility-control" class="utility-control">
              <button id="about-button" class="icon-button" title="帮助与关于" aria-label="帮助与关于" aria-haspopup="menu" aria-expanded="false">${icons.about}</button>
              <div id="utility-popover" class="utility-popover" role="menu" aria-label="帮助与关于" hidden>
                <button type="button" role="menuitem" disabled><i>?</i><span><strong>帮助</strong><small>帮助中心将在后续版本提供</small></span><em>规划中</em></button>
                <button id="shortcuts-menu-item" type="button" role="menuitem"><i>⌨</i><span><strong>快捷键</strong><small>查看键盘与画布操作速查</small></span><b>›</b></button>
                <button id="about-menu-item" type="button" role="menuitem"><i>i</i><span><strong>关于</strong><small>版本、实现者与开源组件</small></span><b>›</b></button>
              </div>
            </div>
          </div>
        </header>

        <div class="workspace">
          <aside class="sidebar" id="sidebar">
            <div class="sidebar-scroll">
              <section class="parameter-section open">
                <button class="section-title"><span>图像格式</span><i>−</i></button>
                <div class="section-content field-grid">
                  ${this.dimensionField()}
                  ${this.selectField("packing", "存储方式", `<option value="unpacked8">Unpacked 8</option><option value="unpacked16">Unpacked 16</option><option value="mipiRaw10">MIPI RAW10</option><option value="mipiRaw12">MIPI RAW12</option><option value="mipiRaw14">MIPI RAW14</option>`)}
                  ${this.selectField("bitDepth", "位深", `<option value="8">8 bit</option><option value="9">9 bit</option><option value="10">10 bit</option><option value="11">11 bit</option><option value="12">12 bit</option><option value="13">13 bit</option><option value="14">14 bit</option><option value="15">15 bit</option><option value="16">16 bit</option>`)}
                  ${this.segmentedField("endianness", "字节序", [["little", "Little"], ["big", "Big"]])}
                  ${this.segmentedField("bitAlignment", "有效位位置", [["lsb", "低位 LSB"], ["msb", "高位 MSB"]])}
                  ${this.selectField("cfa", "CFA 排列", `<option value="MONO">Mono</option><optgroup label="标准 Bayer"><option value="RGGB">RGGB</option><option value="BGGR">BGGR</option><option value="GBRG">GBRG</option><option value="GRBG">GRBG</option></optgroup><optgroup label="Quad CFA"><option value="QRGGB">Quad RGGB</option><option value="QBGGR">Quad BGGR</option><option value="QGBRG">Quad GBRG</option><option value="QGRBG">Quad GRBG</option></optgroup>`)}
                  ${this.cfaPhaseField()}
                </div>
              </section>

              <section class="parameter-section open" id="image-processing-section" hidden>
                <button class="section-title"><span>图像处理</span><i>−</i></button>
                <div class="section-content field-grid">
                  <div class="parameter-row" id="demosaic-processing-row">
                    <span class="field-label" data-help="当前彩色 CFA 的 Demosaic 使用双线性插值；后续算法将在此扩展。">Demosaic 算法</span>
                    <span class="processing-value">双线性</span>
                  </div>
                  <label class="parameter-row processing-toggle-row" id="remosaic-processing-row" hidden>
                    <span class="field-label" data-help="按目标 Bayer 站点从相同颜色的 QCFA 样本进行双线性重建。相比仅重排需要更多 CPU 计算，超大图像或频繁缩放时，瓦片完成时间可能明显增加。">同色双线性重建（高计算量）</span>
                    <input id="processing-same-color-reconstruction" type="checkbox" role="switch"/>
                  </label>
                </div>
              </section>

              <section class="parameter-section open" id="presentation-section">
                <button class="section-title"><span>画面呈现</span><i>−</i></button>
                <div class="section-content field-grid">
                  <label class="parameter-row">
                    <span class="field-label" data-help="仅改变 R/G/B 通道视图的着色，不改变重建 DN 或导出数据">RGB 通道渲染</span>
                    <select id="presentation-channel-rendering"><option value="color">通道颜色</option><option value="grayscale">灰度（仅强度）</option></select>
                  </label>
                  <label class="parameter-row processing-toggle-row">
                    <span class="field-label" data-help="RAW 强度与 Bayer 点阵始终显示原始 DN">高倍率显示像素值</span>
                    <input id="presentation-pixel-values" type="checkbox" role="switch"/>
                  </label>
                  <label class="parameter-row presentation-color-row">
                    <span class="field-label" data-help="只改变高倍率像素网格，不改变图像或像素值">像素网格颜色</span>
                    <input id="presentation-pixel-grid-color" type="color" value="#8ecde4"/>
                  </label>
                  <label class="parameter-row" id="presentation-demosaic-values-row">
                    <span class="field-label" data-help="RGB 为原始位深范围内的插值分量，不是 8-bit 显示值">Demosaic 数值内容</span>
                    <select id="presentation-demosaic-pixel-values"><option value="rawDn">原始 DN</option><option value="rgb">三行插值 RGB</option></select>
                  </label>
                  <label class="parameter-row">
                    <span class="field-label" data-help="只改变预览中无法从文件读取的像素，不改变导出填充值">缺失数据外观</span>
                    <select id="presentation-missing-pixel-pattern"><option value="darkCheckerboard">深色棋盘格</option><option value="lightCheckerboard">浅色棋盘格</option><option value="solid">纯色</option></select>
                  </label>
                  <label class="parameter-row presentation-color-row" id="presentation-missing-pixel-color-row">
                    <span class="field-label">纯色颜色</span>
                    <input id="presentation-missing-pixel-color" type="color" value="#808080"/>
                  </label>
                </div>
              </section>

              <section class="parameter-section open">
                <button class="section-title"><span>行与帧布局</span><i>−</i></button>
                <div class="section-content field-grid">
                  ${this.numberField("headerOffset", "文件头偏移", "B", 0, undefined, undefined, true, true)}
                  ${this.numberField("rowAlignment", "行对齐", "B", 1, undefined, undefined, true, true)}
                  ${this.numberField("rowStride", "显式行步长", "B", 0, undefined, "0 = 自动", true, true)}
                  ${this.numberField("frameAlignment", "帧对齐", "B", 1, undefined, undefined, true, true)}
                  ${this.numberField("frameStride", "显式帧步长", "B", 0, undefined, "0 = 自动", true, true)}
                </div>
              </section>
            </div>
          </aside>

          <div id="sidebar-resizer" class="sidebar-resizer" role="separator" aria-label="调整参数面板宽度" aria-orientation="vertical" tabindex="0"></div>

          <main class="canvas-area">
            <div class="viewport" id="viewport">
              <canvas class="raw-canvas"></canvas>
              <canvas class="pixel-value-overlay" aria-hidden="true"></canvas>
              <svg class="image-boundary" aria-hidden="true" width="100%" height="100%" preserveAspectRatio="none">
                <rect class="image-boundary-rect image-boundary-shadow"></rect>
                <rect class="image-boundary-rect image-boundary-line"></rect>
                <rect class="image-selection"></rect>
              </svg>
              <div class="canvas-crosshair" aria-hidden="true"><i class="crosshair-horizontal"></i><i class="crosshair-vertical"></i></div>
              <div class="empty-state" id="empty-state">
                <div class="empty-grid"><span></span><span></span><span></span><span></span></div>
                <h1>查看传感器的真实输出</h1>
                <p>打开 RAW 文件，配置尺寸、packing、CFA 和对齐参数</p>
                <button id="empty-open-button">${icons.open} 打开 RAW 图像</button>
                <small>滚轮缩放 · 左键拖动 · 双击切换适应窗口/100%</small>
              </div>
              <div class="image-scrollbar horizontal"><div class="scroll-thumb"></div></div>
              <div class="image-scrollbar vertical"><div class="scroll-thumb"></div></div>
            </div>
            <div id="canvas-context-menu" class="canvas-context-menu" role="menu" aria-label="图像抓拍" hidden>
              <button type="button" role="menuitem" data-statistics-open>图像统计…</button>
              <hr role="separator"/>
              <button type="button" role="menuitem" data-capture-kind="current" data-capture-destination="save">当前画面另存为…</button>
              <button type="button" role="menuitem" data-capture-kind="current" data-capture-destination="copy">复制当前画面</button>
              <hr role="separator"/>
              <button type="button" role="menuitem" data-capture-kind="preview" data-capture-destination="save">完整预览图另存为…</button>
              <button type="button" role="menuitem" data-capture-kind="preview" data-capture-destination="copy">复制完整预览图</button>
            </div>
            <div class="frame-strip" id="frame-strip">
              <button id="first-frame" title="第一帧">|‹</button><button id="previous-frame" title="上一帧">‹</button>
              <div class="frame-counter"><span>FRAME</span><input id="frame-input" type="number" min="1" value="1"/><b>/</b><strong id="frame-total">0</strong></div>
              <button id="next-frame" title="下一帧">›</button><button id="last-frame" title="最后一帧">›|</button>
            </div>
            <section id="statistics-dock" class="statistics-dock" hidden>
              <div id="statistics-resizer" class="statistics-resizer" role="separator" aria-orientation="horizontal" aria-label="调整图像统计区域高度"></div>
              <div id="statistics-panel" class="statistics-panel"></div>
            </section>
          </main>
        </div>

        <section id="diagnostics-drawer" class="diagnostics-drawer" aria-hidden="true">
          <header>
            <div><strong>诊断信息</strong><span id="diagnostics-summary">等待文件</span></div>
            <button id="close-diagnostics" class="diagnostics-close" title="关闭诊断面板" aria-label="关闭诊断面板">×</button>
          </header>
          <div id="diagnostics-list" class="diagnostics-list"><div class="no-warning">打开文件后显示布局诊断与运行时错误</div></div>
        </section>

        <footer class="statusbar">
          <button id="status-warning" class="status-warning" aria-expanded="false" aria-controls="diagnostics-drawer">${icons.warning}<span>诊断</span><b id="diagnostics-count" hidden>0</b></button>
          <i></i><span id="file-status" class="file-status">未打开文件</span>
          <button id="pixel-status" class="status-pixel" title="输入坐标并定位像素" aria-haspopup="dialog" disabled>X — · Y —</button><i></i>
          <span id="render-status" class="status-help" data-help="L 表示当前预览层级；Lx↔Ly 表示正在平滑混合相邻层级。tiles 是当前视野中已完成的瓦片数；loading 是正在解码、传输或上传纹理的请求数，0 表示已完成或命中缓存。">L0 · 0 tiles · 0 loading</span>
          <i></i><button id="zoom-status" class="status-zoom" title="输入画布缩放比例" aria-haspopup="dialog" disabled>100.00%</button>
        </footer>
        <div class="toast" id="toast" role="status"></div>
        <div class="parameter-tooltip" id="parameter-tooltip" role="tooltip"></div>

        ${exportDialogTemplate()}
        ${this.pixelLocatorDialogTemplate()}
        ${this.zoomDialogTemplate()}
        ${this.settingsDialogTemplate()}
        ${this.shortcutsDialogTemplate()}
        ${this.aboutDialogTemplate()}
      </div>`;
  }

  private dimensionField(): string {
    return `<div class="parameter-row dimension-row"><span class="field-label" data-help="${this.parameterHelp("dimensions")}">有效分辨率</span><div class="dimension-control">
      <div class="number-input"><input id="descriptor-width" data-field="width" type="number" min="1" max="${MAX_IMAGE_DIMENSION}" step="1" aria-label="有效宽度"/></div>
      <i>×</i>
      <div class="number-input"><input id="descriptor-height" data-field="height" type="number" min="1" max="${MAX_IMAGE_DIMENSION}" step="1" aria-label="有效高度"/></div>
    </div></div>`;
  }

  private cfaPhaseField(): string {
    const phaseControl = (axis: "X" | "Y", field: "cfaPhaseX" | "cfaPhaseY") => `
      <div class="phase-axis"><i>${axis}</i><button type="button" data-step-target="${field}" data-step="-1" aria-label="${t("help.decrease", { label: `CFA Phase ${axis}` })}">−</button>
        <input id="descriptor-${field}" data-field="${field}" type="number" min="0" max="3" step="1" aria-label="CFA Phase ${axis}"/>
        <button type="button" data-step-target="${field}" data-step="1" aria-label="${t("help.increase", { label: `CFA Phase ${axis}` })}">+</button>
      </div>`;
    return `<div class="parameter-row cfa-phase-row" id="cfa-phase-row" hidden>
      <span class="field-label" data-help="${this.parameterHelp("cfaPhase")}">CFA Phase X/Y</span>
      <div class="cfa-phase-control">${phaseControl("X", "cfaPhaseX")}${phaseControl("Y", "cfaPhaseY")}</div>
    </div>`;
  }

  private selectField(field: string, label: string, options: string): string {
    return `<div class="parameter-row" id="${field}-row"><span class="field-label" data-help="${this.parameterHelp(field)}">${label}</span><select id="descriptor-${field}" data-field="${field}" aria-label="${label}">${options}</select></div>`;
  }

  private segmentedField(field: string, label: string, options: Array<[string, string]>): string {
    const buttons = options.map(([value, text]) => `<button type="button" data-value="${value}" aria-pressed="false">${text}</button>`).join("");
    return `<div class="parameter-row" id="${field}-row"><span class="field-label" id="${field}-label" data-help="${this.parameterHelp(field)}">${label}</span><div class="segmented-control" data-field="${field}" role="group" aria-labelledby="${field}-label">${buttons}</div></div>`;
  }

  private numberField(field: string, label: string, unit: string, min: number, max?: number, hint?: string, descriptorField = true, adjustable = false): string {
    const inputId = descriptorField ? `descriptor-${field}` : field;
    const input = `<div class="number-input"><input id="${inputId}" type="number" ${descriptorField ? `data-field="${field}"` : ""} min="${min}" ${max === undefined ? "" : `max="${max}"`} step="1" ${hint ? `placeholder="${hint}"` : ""}/><b>${unit}</b></div>`;
    const control = adjustable ? `<div class="stepper-control"><button type="button" data-step-target="${field}" data-step="-1" aria-label="${t("help.decrease", { label })}">−</button>${input}<button type="button" data-step-target="${field}" data-step="1" aria-label="${t("help.increase", { label })}">+</button></div>` : input;
    return `<div class="parameter-row"><span class="field-label" data-help="${this.parameterHelp(field)}">${label}</span>${control}</div>`;
  }

  private parameterHelp(field: string): string {
    const descriptions: Partial<Record<string, MessageKey>> = {
      dimensions: "help.dimensions",
      bitDepth: "help.bitDepth",
      packing: "help.packing",
      endianness: "help.endianness",
      bitAlignment: "help.bitAlignment",
      cfa: "help.cfa",
      cfaPhase: "help.cfaPhase",
      headerOffset: "help.headerOffset",
      rowAlignment: "help.rowAlignment",
      rowStride: "help.rowStride",
      frameAlignment: "help.frameAlignment",
      frameStride: "help.frameStride",
    };
    const key = descriptions[field];
    return key ? escapeHtml(t(key, { max: MAX_IMAGE_DIMENSION })) : "";
  }

  private pixelLocatorDialogTemplate(): string {
    return `<dialog id="pixel-locator-dialog" class="modal pixel-locator-modal">
      <form id="pixel-locator-form">
        <header><div><small>PIXEL NAVIGATION</small><h2>定位像素</h2></div><button id="close-pixel-locator" type="button" class="dialog-close" aria-label="关闭">×</button></header>
        <div class="pixel-locator-body">
          <p>输入从 0 开始的 RAW 像素坐标。定位后将使用最大倍率，并把该像素置于画布中央。</p>
          <div class="pixel-coordinate-grid">
            <label><span>X 坐标</span><div class="number-input"><input id="pixel-locator-x" type="number" min="0" step="1" required/><b>px</b></div></label>
            <label><span>Y 坐标</span><div class="number-input"><input id="pixel-locator-y" type="number" min="0" step="1" required/><b>px</b></div></label>
          </div>
        </div>
        <footer><p id="pixel-locator-range">—</p><div><button id="cancel-pixel-locator" type="button" class="secondary-button">取消</button><button type="submit" class="primary-button">定位并放大</button></div></footer>
      </form>
    </dialog>`;
  }

  private zoomDialogTemplate(): string {
    return `<dialog id="zoom-dialog" class="modal zoom-modal">
      <form id="zoom-form" novalidate>
        <header><div><small>VIEWPORT SCALE</small><h2>设置缩放比例</h2></div><button id="close-zoom-dialog" type="button" class="dialog-close" aria-label="关闭">×</button></header>
        <div class="zoom-body">
          <p>输入画布缩放百分比。画布支持连续缩放，并以当前画布中心为锚点，不改变 RAW 数据或显示模式。</p>
          <label><span>缩放比例</span><div class="number-input"><input id="zoom-input" type="number" step="0.01" required aria-describedby="zoom-effective zoom-range"/><b>%</b></div></label>
          <p id="zoom-effective" class="zoom-effective" aria-live="polite">支持连续缩放，将按输入比例应用</p>
        </div>
        <footer><p id="zoom-range">—</p><div><button id="cancel-zoom-dialog" type="button" class="secondary-button">取消</button><button type="submit" class="primary-button">应用缩放</button></div></footer>
      </form>
    </dialog>`;
  }

  private shortcutsDialogTemplate(): string {
    return `<dialog id="shortcuts-dialog" class="modal shortcuts-modal"><form method="dialog">
      <header><div><small>KEYBOARD & CANVAS REFERENCE</small><h2>快捷键</h2></div><button value="cancel" class="dialog-close">×</button></header>
      <div class="shortcuts-body">
        <section><h3>文件与视图</h3>
          <div><span>打开 RAW 文件</span><kbd>Ctrl</kbd><kbd>O</kbd></div>
          <div><span>关闭当前 RAW 文件</span><kbd>Ctrl</kbd><kbd>W</kbd></div>
          <div><span>导出当前帧</span><kbd>Ctrl</kbd><kbd>E</kbd></div>
          <div><span>适应窗口</span><kbd>Ctrl</kbd><kbd>0</kbd></div>
          <div><span>100% 实际像素</span><kbd>Ctrl</kbd><kbd>1</kbd></div>
          <div><span>切换全屏</span><kbd>F11</kbd></div>
        </section>
        <section><h3>画布操作</h3>
          <div><span>以指针位置连续缩放</span><kbd>滚轮</kbd></div>
          <div><span>平移图像</span><kbd>左键拖动</kbd></div>
          <div><span>切换适应窗口 / 100%</span><kbd>双击</kbd></div>
          <div><span>关闭菜单或诊断面板</span><kbd>Esc</kbd></div>
        </section>
        <section><h3>参数输入</h3>
          <div><span>提交当前输入并离开</span><kbd>Enter</kbd></div>
          <div><span>提交并切换到下一项</span><kbd>Tab</kbd></div>
        </section>
      </div>
      <footer><button value="cancel" class="primary-button">完成</button></footer>
    </form></dialog>`;
  }

  private aboutDialogTemplate(): string {
    return `<dialog id="about-dialog" class="modal about-modal"><form method="dialog">
      <button value="cancel" class="dialog-close floating">×</button>
      <div class="about-hero"><img src="${erawIconUrl}" alt="eRAW"/><div><small>RAW SENSOR LAB</small><h2>eRAW</h2><p>V${VERSION}</p><time id="about-build-time" datetime="${BUILD_TIME_SOURCE}">${t("about.builtAt", { time: formatDateTime(BUILD_TIME_SOURCE) })}</time></div></div>
      <div class="about-copy">
        <div class="about-credits">
          <div><span>产品设计</span><strong>凌净清河</strong></div>
          <div><span>工程实现</span><strong>Codex (GPT-5.6 Sol)</strong></div>
        </div>
        <button id="open-source-components" type="button" class="about-link"><span><strong>开源组件</strong><small>查看主要第三方组件与许可证信息</small></span><b>›</b></button>
      </div>
      <footer><button value="cancel" class="primary-button">完成</button></footer>
    </form></dialog>
    <dialog id="open-source-dialog" class="modal open-source-modal"><form method="dialog">
      <header><div><small>OPEN SOURCE ACKNOWLEDGEMENTS</small><h2>主要开源组件</h2></div><button value="cancel" class="dialog-close">×</button></header>
      <div class="open-source-body">
        <p>eRAW 使用以下主要开源组件。组件版权归各自权利人所有，使用与再分发遵循其各自许可证。本页用于快速查阅，不替代组件附带的完整许可文本。</p>
        <div class="component-list">
          <div><strong>Tauri 2 与 @tauri-apps/api</strong><span>桌面应用框架与前端接口</span><code>MIT OR Apache-2.0</code></div>
          <div><strong>Tauri Dialog Plugin</strong><span>系统文件选择对话框</span><code>MIT OR Apache-2.0</code></div>
          <div><strong>Serde 与 serde_json</strong><span>Rust 数据序列化</span><code>MIT OR Apache-2.0</code></div>
          <div><strong>memmap2</strong><span>RAW 文件内存映射</span><code>MIT OR Apache-2.0</code></div>
          <div><strong>Vite</strong><span>前端构建工具</span><code>MIT</code></div>
          <div><strong>TypeScript</strong><span>前端类型系统与编译工具</span><code>Apache-2.0</code></div>
        </div>
        <p class="open-source-note">完整传递依赖许可证清单将在正式公开发布前随源代码与发布产物提供。</p>
      </div>
      <footer><button id="back-to-about" type="button" class="secondary-button">返回关于</button><button value="cancel" class="primary-button">完成</button></footer>
    </form></dialog>`;
  }

  private settingsDialogTemplate(): string {
    return `<dialog id="settings-dialog" class="modal settings-modal"><form method="dialog">
      <header><div><small>APPLICATION PREFERENCES</small><h2>设置</h2></div><button value="cancel" class="dialog-close">×</button></header>
      <div class="settings-body">
        <section class="settings-group"><div class="settings-heading"><h3>外观</h3><p>调整界面文字与动态效果，不改变 RAW 图像的显示比例。</p></div>
          <label class="settings-row"><div><strong>界面字号</strong><span>高分辨率显示器推荐使用“大”或“特大”</span></div><select id="setting-font-size"><option value="standard">标准</option><option value="large">大</option><option value="extraLarge">特大</option></select></label>
          <label class="settings-row"><div><strong>参数栏位置</strong><span>将图像格式和布局参数放在窗口左侧或右侧</span></div><select id="setting-sidebar-position"><option value="left">左侧</option><option value="right">右侧</option></select></label>
          <label class="settings-row toggle-row"><div><strong>减少动态效果</strong><span>关闭面板、弹窗和提示的过渡动画</span></div><input id="setting-reduce-motion" type="checkbox"/></label>
        </section>
        <section class="settings-group"><div class="settings-heading"><h3>操作</h3><p>控制打开文件和画布交互的默认行为。</p></div>
          <label class="settings-row"><div><strong>打开图像时</strong><span>决定新文件的初始缩放方式</span></div><select id="setting-open-view"><option value="fit">适应窗口</option><option value="actual">100% 实际像素</option></select></label>
          <label class="settings-row"><div><strong>滚轮缩放速度</strong><span>缩放始终以鼠标指向的图像位置为中心</span></div><select id="setting-wheel-speed"><option value="gentle">柔和</option><option value="standard">标准</option><option value="fast">快速</option></select></label>
          <label class="settings-row toggle-row"><div><strong>记住 RAW 参数</strong><span>下次启动时恢复尺寸、packing、CFA 和对齐配置</span></div><input id="setting-remember-descriptor" type="checkbox"/></label>
        </section>
        <section class="settings-group"><div class="settings-heading"><h3>性能</h3><p>更大的 GPU 缓存可减少超大图像来回拖动时的瓦片重载。</p></div>
          <label class="settings-row"><div><strong>GPU 瓦片缓存</strong><span>只缓存预览纹理，不复制完整 RAW 文件</span></div><select id="setting-tile-cache"><option value="compact">32 MiB</option><option value="balanced">64 MiB（推荐）</option><option value="large">128 MiB</option></select></label>
        </section>
      </div>
      <footer><button id="reset-settings" type="button" class="text-button">恢复默认设置</button><span class="footer-spacer"></span><button value="cancel" class="secondary-button">取消</button><button id="confirm-settings" type="button" class="primary-button">应用</button></footer>
    </form></dialog>`;
  }

  private bindEvents(): void {
    this.get("open-button").addEventListener("click", () => void this.toggleFile());
    this.get("empty-open-button").addEventListener("click", () => void this.openFile());
    this.get<HTMLButtonElement>("export-button").addEventListener("click", (event) => {
      event.stopPropagation();
      this.setExportMenuOpen(this.get("export-popover").hidden);
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-export-target]").forEach((button) => {
      button.addEventListener("click", () => {
        this.setExportMenuOpen(false);
        void this.openExport(button.dataset.exportTarget as ExportTarget);
      });
    });
    this.get("fit-button").addEventListener("click", () => this.viewport.fit());
    this.get("actual-button").addEventListener("click", () => this.viewport.actualSize());
    this.get("panel-button").addEventListener("click", () => {
      this.root.querySelector(".app-shell")!.classList.toggle("panel-hidden");
      this.get("panel-button").classList.toggle("active");
    });
    this.get("language-button").addEventListener("click", (event) => {
      event.stopPropagation();
      this.setLanguageMenuOpen(this.get("language-popover").hidden);
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-language-value]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.languageValue;
        if (isLanguagePreference(value)) this.setLanguage(value);
      });
    });
    this.get("theme-button").addEventListener("click", (event) => {
      event.stopPropagation();
      this.setThemeMenuOpen(this.get("theme-popover").hidden);
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-theme-value]").forEach((button) => button.addEventListener("click", () => {
      this.setTheme(button.dataset.themeValue as AppTheme);
    }));
    document.addEventListener("pointerdown", (event) => {
      if (!(event.target instanceof Element) || !event.target.closest("#language-control")) this.setLanguageMenuOpen(false);
      if (!(event.target instanceof Element) || !event.target.closest("#theme-control")) this.setThemeMenuOpen(false);
      if (!(event.target instanceof Element) || !event.target.closest("#utility-control")) this.setUtilityMenuOpen(false);
      if (!(event.target instanceof Element) || !event.target.closest("#export-control")) this.setExportMenuOpen(false);
      if (!(event.target instanceof Element) || !event.target.closest("#canvas-context-menu")) this.setCanvasContextMenuOpen(false);
    });
    document.addEventListener("contextmenu", (event) => this.onContextMenu(event));
    this.root.querySelector<HTMLButtonElement>("[data-statistics-open]")?.addEventListener("click", () => {
      this.setCanvasContextMenuOpen(false);
      void this.openStatistics();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-capture-kind][data-capture-destination]").forEach((button) => {
      button.addEventListener("click", () => {
        const kind = button.dataset.captureKind as "current" | "preview";
        const destination = button.dataset.captureDestination as "save" | "copy";
        void this.performImageCapture(kind, destination);
      });
    });
    this.get("statistics-resizer").addEventListener("pointerdown", (event) => {
      const pointer = event as PointerEvent;
      pointer.preventDefault();
      this.statisticsResizeStartY = pointer.clientY;
      this.statisticsResizeStartHeight = this.statisticsDockHeight;
      this.get("statistics-resizer").setPointerCapture(pointer.pointerId);
      this.root.querySelector(".app-shell")?.classList.add("resizing-statistics");
    });
    this.get("statistics-resizer").addEventListener("pointermove", (event) => {
      const pointer = event as PointerEvent;
      if (!this.get("statistics-resizer").hasPointerCapture(pointer.pointerId)) return;
      this.statisticsDockHeight = Math.max(
        210,
        Math.min(window.innerHeight * 0.72, this.statisticsResizeStartHeight + this.statisticsResizeStartY - pointer.clientY),
      );
      this.updateStatisticsDock();
    });
    this.get("statistics-resizer").addEventListener("pointerup", (event) => {
      const pointer = event as PointerEvent;
      if (this.get("statistics-resizer").hasPointerCapture(pointer.pointerId)) {
        this.get("statistics-resizer").releasePointerCapture(pointer.pointerId);
      }
      this.root.querySelector(".app-shell")?.classList.remove("resizing-statistics");
    });
    this.get("settings-button").addEventListener("click", () => {
      this.setLanguageMenuOpen(false);
      this.setThemeMenuOpen(false);
      this.setUtilityMenuOpen(false);
      this.openSettingsDialog();
    });
    this.get("about-button").addEventListener("click", (event) => {
      event.stopPropagation();
      this.setUtilityMenuOpen(this.get("utility-popover").hidden);
    });
    this.get("shortcuts-menu-item").addEventListener("click", () => {
      this.setUtilityMenuOpen(false);
      this.get<HTMLDialogElement>("shortcuts-dialog").showModal();
    });
    this.get("about-menu-item").addEventListener("click", () => {
      this.setUtilityMenuOpen(false);
      this.get<HTMLDialogElement>("about-dialog").showModal();
    });
    this.get("open-source-components").addEventListener("click", () => {
      this.get<HTMLDialogElement>("about-dialog").close();
      this.get<HTMLDialogElement>("open-source-dialog").showModal();
    });
    this.get("back-to-about").addEventListener("click", () => {
      this.get<HTMLDialogElement>("open-source-dialog").close();
      this.get<HTMLDialogElement>("about-dialog").showModal();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.addEventListener("click", () => this.setDisplayMode(button.dataset.mode as DisplayMode)));
    this.root.querySelectorAll<HTMLElement>("[data-field]").forEach((element) => {
      if (element instanceof HTMLSelectElement) element.addEventListener("change", () => {
        this.updatePackingDependentUi();
        if (element.dataset.field === "cfa") this.updateCfaDependentUi();
        void this.commitDescriptor();
      });
      else if (element instanceof HTMLInputElement) {
        element.addEventListener("blur", () => void this.commitDescriptor());
        element.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); element.blur(); } });
      } else if (element.classList.contains("segmented-control")) {
        element.querySelectorAll<HTMLButtonElement>("[data-value]").forEach((button) => button.addEventListener("click", () => {
          this.setSegmentedValue(element, button.dataset.value ?? "");
          void this.commitDescriptor();
        }));
      }
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-step-target]").forEach((button) => button.addEventListener("click", () => {
      const field = button.dataset.stepTarget!;
      const input = this.root.querySelector<HTMLInputElement>(`input[data-field="${field}"]`)!;
      const min = Number(input.min || 0);
      const max = input.max ? Number(input.max) : Number.MAX_SAFE_INTEGER;
      const next = Math.max(min, Math.min(max, Math.trunc(Number(input.value) || 0) + Number(button.dataset.step)));
      input.value = String(next);
      void this.commitDescriptor();
    }));
    this.get<HTMLInputElement>("processing-same-color-reconstruction").addEventListener("change", (event) => {
      this.processing = {
        ...this.processing,
        remosaic: {
          ...this.processing.remosaic,
          sameColorReconstruction: (event.currentTarget as HTMLInputElement).checked,
        },
      };
      localStorage.setItem(PROCESSING_KEY, JSON.stringify(this.processing));
      this.updateCfaDependentUi(false);
      this.updateDisplay();
    });
    this.bindParameterHelp();
    this.root.querySelectorAll<HTMLButtonElement>(".section-title").forEach((button) => button.addEventListener("click", () => {
      const section = button.closest(".parameter-section")!;
      section.classList.toggle("open");
      button.querySelector("i")!.textContent = section.classList.contains("open") ? "−" : "+";
    }));
    this.get("status-warning").addEventListener("click", () => this.toggleDiagnostics());
    this.get("pixel-status").addEventListener("click", () => this.openPixelLocator());
    this.get("zoom-status").addEventListener("click", () => this.openZoomDialog());
    this.get("close-diagnostics").addEventListener("click", () => this.setDiagnosticsOpen(false));
    this.bindSidebarResize();
    this.get("first-frame").addEventListener("click", () => this.setFrame(0));
    this.get("previous-frame").addEventListener("click", () => this.setFrame(this.frame - 1));
    this.get("next-frame").addEventListener("click", () => this.setFrame(this.frame + 1));
    this.get("last-frame").addEventListener("click", () => this.setFrame((this.document?.layout.frameCount ?? 1) - 1));
    this.get<HTMLInputElement>("frame-input").addEventListener("change", (event) => this.setFrame(Number((event.currentTarget as HTMLInputElement).value) - 1));
    this.get("confirm-settings").addEventListener("click", () => this.saveSettingsFromDialog());
    this.get("reset-settings").addEventListener("click", () => this.writeSettingsForm(DEFAULT_SETTINGS));
    this.get<HTMLSelectElement>("presentation-channel-rendering").addEventListener("change", () => this.savePresentationSettings());
    this.get<HTMLInputElement>("presentation-pixel-values").addEventListener("change", () => this.savePresentationSettings());
    this.get<HTMLInputElement>("presentation-pixel-grid-color").addEventListener("input", () => this.savePresentationSettings());
    this.get<HTMLSelectElement>("presentation-demosaic-pixel-values").addEventListener("change", () => this.savePresentationSettings());
    this.get<HTMLSelectElement>("presentation-missing-pixel-pattern").addEventListener("change", () => this.savePresentationSettings());
    this.get<HTMLInputElement>("presentation-missing-pixel-color").addEventListener("input", () => this.savePresentationSettings());
    this.get("pixel-locator-form").addEventListener("submit", (event) => { event.preventDefault(); this.locatePixel(); });
    this.get("close-pixel-locator").addEventListener("click", () => this.get<HTMLDialogElement>("pixel-locator-dialog").close());
    this.get("cancel-pixel-locator").addEventListener("click", () => this.get<HTMLDialogElement>("pixel-locator-dialog").close());
    this.get("zoom-form").addEventListener("submit", (event) => { event.preventDefault(); this.applyZoomFromDialog(); });
    this.get<HTMLInputElement>("zoom-input").addEventListener("input", () => this.updateZoomInputPreview());
    this.get("close-zoom-dialog").addEventListener("click", () => this.get<HTMLDialogElement>("zoom-dialog").close());
    this.get("cancel-zoom-dialog").addEventListener("click", () => this.get<HTMLDialogElement>("zoom-dialog").close());
    window.addEventListener("keydown", (event) => this.onKeyDown(event));
    window.addEventListener("resize", () => {
      this.setCanvasContextMenuOpen(false);
      this.setSidebarWidth(this.settings.sidebarWidth, false);
    });
    window.addEventListener("blur", () => this.setCanvasContextMenuOpen(false));
    window.addEventListener("languagechange", () => {
      if (this.settings.language === "system") this.setLanguage("system");
    });
  }

  private updatePackingDependentUi(): void {
    const depth = this.root.querySelector<HTMLSelectElement>('[data-field="bitDepth"]')!;
    const packing = this.root.querySelector<HTMLSelectElement>('[data-field="packing"]')!;
    const state = packingControlState(packing.value as Packing, Number(depth.value));
    depth.value = String(state.bitDepth);
    depth.disabled = state.bitDepthLocked;
    this.get("endianness-row").toggleAttribute("hidden", !state.endiannessVisible);
    this.get("bitAlignment-row").toggleAttribute("hidden", !state.bitAlignmentVisible);
  }

  private bindParameterHelp(): void {
    const tooltip = this.get("parameter-tooltip");
    let showTimer = 0;
    let pointerX = 0;
    let pointerY = 0;
    const move = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!tooltip.classList.contains("visible")) return;
      const margin = 12;
      const x = Math.min(window.innerWidth - tooltip.offsetWidth - margin, pointerX + 14);
      const y = Math.min(window.innerHeight - tooltip.offsetHeight - margin, pointerY + 18);
      tooltip.style.left = `${Math.max(margin, x)}px`;
      tooltip.style.top = `${Math.max(margin, y)}px`;
    };
    const hide = () => {
      window.clearTimeout(showTimer);
      showTimer = 0;
      tooltip.classList.remove("visible");
    };
    this.root.querySelectorAll<HTMLElement>("[data-help]").forEach((target) => {
      target.addEventListener("pointerenter", (event) => {
        hide();
        pointerX = event.clientX;
        pointerY = event.clientY;
        showTimer = window.setTimeout(() => {
          tooltip.textContent = target.dataset.help ?? "";
          tooltip.classList.add("visible");
          const margin = 12;
          const x = Math.min(window.innerWidth - tooltip.offsetWidth - margin, pointerX + 14);
          const y = Math.min(window.innerHeight - tooltip.offsetHeight - margin, pointerY + 18);
          tooltip.style.left = `${Math.max(margin, x)}px`;
          tooltip.style.top = `${Math.max(margin, y)}px`;
          showTimer = 0;
        }, 500);
      });
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerleave", hide);
    });
  }

  private async toggleFile(): Promise<void> {
    if (this.document) await this.closeFile();
    else await this.openFile();
  }

  private async openFile(): Promise<void> {
    if (this.fileOperationInProgress) return;
    this.fileOperationInProgress = true;
    this.updateDocumentUi();
    try {
      await this.flushDescriptor();
      const path = await chooseRawFile();
      if (!path) return;
      this.showToast(t("runtime.opening"), "busy");
      const info = await openDocument(path, this.readDescriptor());
      this.document = info;
      this.descriptor = info.descriptor;
      this.frame = 0;
      this.viewport.setDocument(info);
      this.statisticsResult = null;
      this.statisticsError = null;
      this.statisticsUseSelection = false;
      if (this.settings.openView === "actual") this.viewport.actualSize();
      this.updateDocumentUi();
      this.syncStatisticsState();
      if (this.statisticsOpen) void this.requestStatistics();
      this.showToast(t("runtime.opened", { name: info.name }), "success");
    } catch (error) {
      this.reportRuntimeError(error);
    } finally {
      this.fileOperationInProgress = false;
      this.updateDocumentUi();
    }
  }

  private async closeFile(): Promise<void> {
    if (!this.document || this.fileOperationInProgress) return;
    if (this.exportDialog.isOpen) {
      this.showToast(t("runtime.closeBlockedByExport"), "error");
      return;
    }
    this.fileOperationInProgress = true;
    this.updateDocumentUi();
    try {
      await this.flushDescriptor();
      const name = this.document?.name;
      if (!name) return;
      this.showToast(t("runtime.closing", { name }), "busy");
      await closeDocument();
      this.document = null;
      this.frame = 0;
      this.lastSample = null;
      this.runtimeDiagnostics = [];
      this.viewport.clearDocument();
      this.statisticsRevision += 1;
      void cancelRawAnalysis(this.statisticsRevision);
      this.statisticsResult = null;
      this.statisticsLoading = false;
      this.statisticsError = null;
      this.statisticsUseSelection = false;
      this.syncStatisticsState();
      this.setExportMenuOpen(false);
      this.setCanvasContextMenuOpen(false);
      this.setDiagnosticsOpen(false);
      this.get<HTMLDialogElement>("pixel-locator-dialog").close();
      this.get<HTMLDialogElement>("zoom-dialog").close();
      this.updateDocumentUi();
      this.showToast(t("runtime.closed", { name }), "success");
    } catch (error) {
      this.reportRuntimeError(error);
    } finally {
      this.fileOperationInProgress = false;
      this.updateDocumentUi();
    }
  }

  private readDescriptor(): RawDescriptor {
    const number = (field: string, minimum = 0, maximum = Number.POSITIVE_INFINITY) => {
      const normalized = normalizeIntegerInput(this.descriptorFieldValue(field), minimum, maximum);
      const input = this.root.querySelector<HTMLInputElement>(`input[data-field="${field}"]`);
      if (input) input.value = String(normalized);
      return normalized;
    };
    const value = <T extends string>(field: string) => this.descriptorFieldValue(field) as T;
    return {
      width: number("width", 1, MAX_IMAGE_DIMENSION), height: number("height", 1, MAX_IMAGE_DIMENSION), bitDepth: Number(value("bitDepth")),
      packing: value<Packing>("packing"), endianness: value<Endianness>("endianness"), bitAlignment: value<BitAlignment>("bitAlignment"), cfa: value<CfaPattern>("cfa"),
      cfaPhaseX: number("cfaPhaseX", 0, 3), cfaPhaseY: number("cfaPhaseY", 0, 3),
      rowAlignment: number("rowAlignment", 1), rowStride: number("rowStride"), frameAlignment: number("frameAlignment", 1), frameStride: number("frameStride"), headerOffset: number("headerOffset"),
    };
  }

  private writeDescriptor(descriptor: RawDescriptor): void {
    for (const [key, value] of Object.entries(descriptor)) {
      const field = this.root.querySelector<HTMLElement>(`[data-field="${key}"]`);
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = String(value);
      else if (field?.classList.contains("segmented-control")) this.setSegmentedValue(field, String(value));
    }
  }

  private descriptorFieldValue(field: string): string {
    const element = this.root.querySelector<HTMLElement>(`[data-field="${field}"]`);
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) return element.value;
    return element?.querySelector<HTMLButtonElement>("[data-value].active")?.dataset.value ?? "";
  }

  private setSegmentedValue(control: HTMLElement, value: string): void {
    control.querySelectorAll<HTMLButtonElement>("[data-value]").forEach((button) => {
      const active = button.dataset.value === value;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  private async commitDescriptor(): Promise<void> {
    this.commitRevision += 1;
    if (this.committing) return;
    this.committing = true;
    try {
      while (true) {
        const revision = this.commitRevision;
        const descriptor = this.readDescriptor();
        const localChanged = !descriptorsEqual(descriptor, this.descriptor);
        this.descriptor = descriptor;
        if (localChanged && this.settings.rememberDescriptor) localStorage.setItem(STORAGE_KEY, JSON.stringify(descriptor));
        if (this.document && !descriptorsEqual(descriptor, this.document.descriptor)) {
          try {
            const info = await updateDescriptor(descriptor);
            this.document = info;
            this.descriptor = info.descriptor;
            this.frame = Math.min(this.frame, Math.max(0, info.layout.frameCount - 1));
            this.viewport.setDocument(info, true);
            this.statisticsResult = null;
            this.updateCfaDependentUi();
            this.updateDocumentUi();
            this.syncStatisticsState();
            if (this.statisticsOpen) void this.requestStatistics();
          } catch (error) {
            this.reportRuntimeError(error);
          }
        }
        if (revision === this.commitRevision) break;
      }
    } finally {
      this.committing = false;
    }
  }

  private async flushDescriptor(): Promise<void> {
    await this.commitDescriptor();
    while (this.committing) {
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    }
  }

  private updateDocumentUi(): void {
    const info = this.document;
    const emptyState = this.get("empty-state");
    emptyState.classList.toggle("hidden", Boolean(info));
    emptyState.setAttribute("aria-hidden", String(Boolean(info)));
    const fileButton = this.get<HTMLButtonElement>("open-button");
    fileButton.classList.toggle("accent", !info);
    fileButton.classList.toggle("close-file", Boolean(info));
    fileButton.disabled = this.fileOperationInProgress;
    fileButton.querySelector("span")!.textContent = info ? t("toolbar.closeFile") : t("toolbar.open");
    fileButton.querySelector("kbd")!.textContent = info ? "Ctrl W" : "Ctrl O";
    const fileActionLabel = info ? t("toolbar.closeFile") : t("toolbar.open");
    fileButton.setAttribute("title", fileActionLabel);
    fileButton.setAttribute("aria-label", fileActionLabel);
    this.get<HTMLButtonElement>("empty-open-button").disabled = Boolean(info) || this.fileOperationInProgress;
    this.get<HTMLButtonElement>("export-button").disabled = !info || info.layout.frameCount === 0;
    this.updateExportAvailability();
    this.updateCaptureMenuAvailability();
    this.get<HTMLButtonElement>("pixel-status").disabled = !info;
    this.get<HTMLButtonElement>("zoom-status").disabled = !info;
    const fileStatus = this.get("file-status");
    fileStatus.textContent = info?.path ?? t("diagnostics.noFile");
    fileStatus.title = info?.path ?? "";
    document.title = info ? `${info.name} — eRAW V${VERSION}` : `eRAW V${VERSION}`;
    const layout = info?.layout;
    const count = layout?.frameCount ?? 0;
    this.get("frame-total").textContent = String(count);
    this.get<HTMLInputElement>("frame-input").value = String(Math.min(this.frame + 1, Math.max(1, count)));
    this.get<HTMLInputElement>("frame-input").max = String(Math.max(1, count));
    this.get("frame-strip").classList.toggle("visible", count > 1);
    this.renderDiagnostics();
  }

  private renderDiagnostics(): void {
    const warnings = this.document?.warnings ?? [];
    const warningMarkup = warnings.map((warning) => {
      const key = WARNING_MESSAGES[warning.code];
      const message = key ? t(key, warning.arguments ?? {}) : warning.message;
      return `<div class="warning-item ${warning.severity}"><span></span><div><strong>${warning.severity === "error" ? t("common.error") : warning.severity === "warning" ? t("common.warning") : t("common.info")}<small>${t("diagnostics.layout")}</small></strong><p>${escapeHtml(message)}</p></div></div>`;
    });
    const runtimeMarkup = this.runtimeDiagnostics.map((diagnostic) => `<div class="warning-item error runtime"><span></span><div><strong>${t("diagnostics.runtime")}<small>${formatTime(diagnostic.timestamp)}${diagnostic.count > 1 ? ` · ${t("diagnostics.repeated", { count: diagnostic.count })}` : ""}</small></strong><p>${escapeHtml(this.runtimeDiagnosticMessage(diagnostic))}</p></div></div>`);
    const list = this.get("diagnostics-list");
    const entries = [...runtimeMarkup, ...warningMarkup];
    list.innerHTML = entries.length ? entries.join("") : `<div class="no-warning">${this.document ? t("diagnostics.normal") : t("diagnostics.openHint")}</div>`;
    const relevant = warnings.filter((warning) => warning.severity !== "info");
    const issueCount = relevant.length + this.runtimeDiagnostics.length;
    const errorPresent = this.runtimeDiagnostics.length > 0 || relevant.some((warning) => warning.severity === "error");
    const count = this.get("diagnostics-count");
    count.textContent = String(issueCount);
    count.toggleAttribute("hidden", issueCount === 0);
    this.get("diagnostics-summary").textContent = issueCount
      ? t("diagnostics.issues", { count: issueCount })
      : this.document ? t("diagnostics.currentNormal") : t("diagnostics.waiting");
    const status = this.get("status-warning");
    status.className = `status-warning ${errorPresent ? "error" : relevant.length ? "warning" : "ok"}`;
  }

  private runtimeDiagnosticMessage(diagnostic: Pick<RuntimeDiagnostic, "source" | "messageKey">): string {
    const detail = localizeBackendError(diagnostic.source).message;
    return diagnostic.messageKey ? t(diagnostic.messageKey, { detail }) : detail;
  }

  private runtimeDiagnosticFingerprint(source: unknown, messageKey?: MessageKey): string {
    let serialized = "";
    try {
      serialized = typeof source === "string" ? source : JSON.stringify(source) ?? String(source);
    } catch {
      serialized = String(source);
    }
    return `${messageKey ?? "backend"}:${serialized.replace(/^Error:\s*/, "").trim()}`;
  }

  private reportRuntimeError(source: unknown, messageKey?: MessageKey, duration = 5000): void {
    const fingerprint = this.runtimeDiagnosticFingerprint(source, messageKey);
    const existing = this.runtimeDiagnostics.find((diagnostic) => diagnostic.fingerprint === fingerprint);
    if (existing) {
      existing.count += 1;
      existing.timestamp = new Date();
      this.runtimeDiagnostics = [existing, ...this.runtimeDiagnostics.filter((diagnostic) => diagnostic !== existing)];
    } else {
      this.runtimeDiagnostics.unshift({ source, messageKey, fingerprint, count: 1, timestamp: new Date() });
      this.runtimeDiagnostics = this.runtimeDiagnostics.slice(0, 50);
    }
    this.renderDiagnostics();
    this.showToast(this.runtimeDiagnosticMessage({ source, messageKey }), "error", duration);
  }

  private toggleDiagnostics(): void {
    const shell = this.root.querySelector<HTMLElement>(".app-shell")!;
    this.setDiagnosticsOpen(!shell.classList.contains("diagnostics-open"));
  }

  private setDiagnosticsOpen(open: boolean): void {
    const shell = this.root.querySelector<HTMLElement>(".app-shell")!;
    shell.classList.toggle("diagnostics-open", open);
    this.get("diagnostics-drawer").setAttribute("aria-hidden", String(!open));
    this.get("status-warning").setAttribute("aria-expanded", String(open));
  }

  private bindSidebarResize(): void {
    const resizer = this.get("sidebar-resizer");
    const stop = (event: PointerEvent) => {
      if (!resizer.hasPointerCapture(event.pointerId)) return;
      resizer.releasePointerCapture(event.pointerId);
      this.root.querySelector(".app-shell")!.classList.remove("resizing-sidebar");
      this.settings.sidebarWidth = this.sidebarWidth;
      this.persistSettings();
    };
    resizer.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      this.sidebarResizeStartX = event.clientX;
      this.sidebarResizeStartWidth = this.sidebarWidth;
      resizer.setPointerCapture(event.pointerId);
      this.root.querySelector(".app-shell")!.classList.add("resizing-sidebar");
    });
    resizer.addEventListener("pointermove", (event) => {
      if (!resizer.hasPointerCapture(event.pointerId)) return;
      const direction = this.settings.sidebarPosition === "right" ? -1 : 1;
      this.setSidebarWidth(
        this.sidebarResizeStartWidth + direction * (event.clientX - this.sidebarResizeStartX),
        false,
      );
    });
    resizer.addEventListener("pointerup", stop);
    resizer.addEventListener("pointercancel", stop);
    resizer.addEventListener("dblclick", () => {
      this.setSidebarWidth(DEFAULT_SIDEBAR_WIDTH, true);
    });
    resizer.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") return;
      event.preventDefault();
      const movement = event.key === "ArrowLeft" ? -16 : 16;
      const direction = this.settings.sidebarPosition === "right" ? -1 : 1;
      const next = event.key === "Home" ? DEFAULT_SIDEBAR_WIDTH : this.sidebarWidth + direction * movement;
      this.setSidebarWidth(next, true);
    });
  }

  private setSidebarWidth(width: number, persist: boolean): void {
    const windowLimit = Math.max(MIN_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.45));
    this.sidebarWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, windowLimit, Math.round(width)));
    this.root.querySelector<HTMLElement>(".app-shell")!.style.setProperty("--sidebar-width", `${this.sidebarWidth}px`);
    const resizer = this.get("sidebar-resizer");
    resizer.setAttribute("aria-valuemin", String(MIN_SIDEBAR_WIDTH));
    resizer.setAttribute("aria-valuemax", String(Math.min(MAX_SIDEBAR_WIDTH, windowLimit)));
    resizer.setAttribute("aria-valuenow", String(this.sidebarWidth));
    if (persist) {
      this.settings.sidebarWidth = this.sidebarWidth;
      this.persistSettings();
    }
  }

  private persistSettings(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  private setLanguage(language: LanguagePreference): void {
    this.settings.language = language;
    this.persistSettings();
    setLanguagePreference(language);
    refreshLocalizedTree();
    const dimensionsHelp = this.root.querySelector<HTMLElement>(".dimension-row .field-label");
    if (dimensionsHelp) {
      dimensionsHelp.dataset.help = t("help.dimensions", { max: MAX_IMAGE_DIMENSION });
    }
    this.root.querySelectorAll<HTMLButtonElement>("[data-step-target]").forEach((stepButton) => {
      const target = stepButton.dataset.stepTarget ?? "";
      const axis = target === "cfaPhaseX" ? "X" : target === "cfaPhaseY" ? "Y" : "";
      const label = axis
        ? `CFA Phase ${axis}`
        : stepButton.closest(".parameter-row")?.querySelector(".field-label")?.textContent?.trim() ?? target;
      const key = Number(stepButton.dataset.step) < 0 ? "help.decrease" : "help.increase";
      stepButton.setAttribute("aria-label", t(key, { label }));
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-language-value]").forEach((option) => {
      const active = option.dataset.languageValue === language;
      option.classList.toggle("active", active);
      option.setAttribute("aria-checked", String(active));
    });
    const options = getLanguageOptions();
    this.root.querySelectorAll<HTMLButtonElement>("[data-language-value]").forEach((option) => {
      const definition = options.find((candidate) => candidate.value === option.dataset.languageValue);
      const label = option.querySelector("span");
      if (definition && label) label.textContent = definition.label;
    });
    const currentName = language === "system"
      ? `${t("language.system")} · ${getLocaleName(getResolvedLocale())}`
      : getLocaleName(getResolvedLocale());
    const button = this.get("language-button");
    const buttonLabel = t("language.current", { language: currentName });
    button.setAttribute("title", buttonLabel);
    button.setAttribute("aria-label", buttonLabel);
    this.get("about-build-time").textContent = t("about.builtAt", {
      time: formatDateTime(BUILD_TIME_SOURCE),
    });
    this.applyTheme();
    this.updateCfaDependentUi(false);
    this.updateDocumentUi();
    this.updateZoomStatus(this.viewport.getZoom());
    this.syncStatisticsState();
    this.setLanguageMenuOpen(false);
  }

  private setLanguageMenuOpen(open: boolean): void {
    if (open) {
      this.setThemeMenuOpen(false);
      this.setUtilityMenuOpen(false);
      this.setExportMenuOpen(false);
    }
    this.get("language-popover").hidden = !open;
    this.get("language-button").setAttribute("aria-expanded", String(open));
  }

  private setTheme(theme: AppTheme): void {
    if (!isAppTheme(theme)) return;
    this.settings.theme = theme;
    this.persistSettings();
    this.applyTheme();
    void this.emitStatisticsState();
    this.setThemeMenuOpen(false);
  }

  private applyTheme(): void {
    document.documentElement.dataset.theme = this.settings.theme;
    const selected = THEMES.find((theme) => theme.id === this.settings.theme)!;
    const selectedName = t(themeMessageKey(selected.id));
    const button = this.get("theme-button");
    button.classList.remove("active");
    button.setAttribute("title", `${t("toolbar.theme")} (${selectedName})`);
    button.setAttribute("aria-label", `${t("toolbar.theme")}: ${selectedName}`);
    this.root.querySelectorAll<HTMLButtonElement>("[data-theme-value]").forEach((option) => {
      const active = option.dataset.themeValue === this.settings.theme;
      option.classList.toggle("active", active);
      option.setAttribute("aria-checked", String(active));
    });
  }

  private setThemeMenuOpen(open: boolean): void {
    if (open) {
      this.setLanguageMenuOpen(false);
      this.setUtilityMenuOpen(false);
      this.setExportMenuOpen(false);
    }
    const popover = this.get("theme-popover");
    popover.hidden = !open;
    this.get("theme-button").setAttribute("aria-expanded", String(open));
  }

  private setUtilityMenuOpen(open: boolean): void {
    if (open) {
      this.setLanguageMenuOpen(false);
      const themePopover = this.get("theme-popover");
      themePopover.hidden = true;
      this.get("theme-button").setAttribute("aria-expanded", "false");
      this.setExportMenuOpen(false);
    }
    this.get("utility-popover").hidden = !open;
    this.get("about-button").setAttribute("aria-expanded", String(open));
  }

  private setExportMenuOpen(open: boolean): void {
    if (open) {
      this.setLanguageMenuOpen(false);
      this.setThemeMenuOpen(false);
      this.setUtilityMenuOpen(false);
    }
    this.get("export-popover").hidden = !open;
    this.get("export-button").setAttribute("aria-expanded", String(open));
  }

  private updateExportAvailability(): void {
    const available = Boolean(this.document?.layout.frameCount);
    const cfa = this.descriptorFieldValue("cfa") as CfaPattern;
    this.get<HTMLButtonElement>("export-remosaic-item").disabled = !available || !isQuadCfa(cfa);
    this.get<HTMLButtonElement>("export-demosaic-item").disabled = !available || !isColorCfa(cfa);
  }

  private updateCfaDependentUi(allowModeFallback = true): void {
    const cfa = this.descriptorFieldValue("cfa") as CfaPattern;
    const quad = isQuadCfa(cfa);
    const color = isColorCfa(cfa);
    this.get("cfa-phase-row").toggleAttribute("hidden", !quad);
    this.get("image-processing-section").toggleAttribute("hidden", !color);
    this.get("cfa-mode").toggleAttribute("hidden", !color);
    this.get("remosaic-processing-row").toggleAttribute("hidden", !quad);
    this.get("remosaic-mode").toggleAttribute("hidden", !quad);
    this.get("demosaic-group").toggleAttribute("hidden", !color);
    this.get<HTMLButtonElement>("demosaic-mode").disabled = !color;
    this.updateExportAvailability();
    this.get("remosaic-mode").setAttribute(
      "title",
      this.processing.remosaic.sameColorReconstruction
        ? t("runtime.remosaicReconstructTitle")
        : t("runtime.remosaicReorderTitle"),
    );
    this.get("demosaic-mode").setAttribute(
      "title",
      quad
        ? t("runtime.quadDemosaicTitle")
        : color
          ? t("runtime.bayerDemosaicTitle")
          : t("runtime.monoDemosaicTitle"),
    );
    if (!color && this.displayMode !== "raw") {
      this.setDisplayMode("raw");
      return;
    }
    if (!allowModeFallback) return;
    if (!quad && this.displayMode === "remosaic") {
      this.setDisplayMode("bayer");
    }
  }

  private setDisplayMode(mode: DisplayMode): void {
    const cfa = this.descriptorFieldValue("cfa") as CfaPattern;
    if (mode === "remosaic" && !isQuadCfa(cfa)) return;
    if (["demosaic", "red", "green", "blue"].includes(mode) && !isColorCfa(cfa)) return;
    this.displayMode = mode;
    this.root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    this.updateDisplay();
  }

  private statisticsState(): StatisticsPanelState {
    return {
      result: this.statisticsResult,
      documentName: this.document?.name ?? null,
      loading: this.statisticsLoading,
      error: this.statisticsError,
      hasSelection: Boolean(this.viewport.getSelection()),
      useSelection: this.statisticsUseSelection,
    };
  }

  private async bindStatisticsWindowEvents(): Promise<void> {
    await listen<StatisticsWindowActionMessage>("statistics:action", (event) => {
      this.onStatisticsAction(event.payload.action, event.payload.source);
    });
    await listen("statistics:ready", () => {
      void this.emitStatisticsState();
    });
    await listen<string>("statistics:window-error", (event) => {
      this.reportRuntimeError(event.payload);
    });
    await listen<string>("statistics:notify", (event) => {
      this.showToast(event.payload, "success");
    });
  }

  private syncStatisticsState(): void {
    const state = this.statisticsState();
    this.statisticsPanel.setState(state);
    if (this.statisticsDetached) void this.emitStatisticsState();
  }

  private async emitStatisticsState(): Promise<void> {
    if (!this.statisticsOpen || !this.statisticsDetached) return;
    try {
      await emitTo("statistics", "statistics:state", {
        state: this.statisticsState(),
        language: this.settings.language,
        theme: this.settings.theme,
      });
    } catch {
      // 独立窗口可能尚未完成初始化；statistics:ready 会再次同步。
    }
  }

  private updateStatisticsDock(): void {
    const dock = this.get("statistics-dock");
    const visible = this.statisticsOpen && !this.statisticsDetached;
    dock.toggleAttribute("hidden", !visible);
    dock.style.setProperty("--statistics-height", `${Math.round(this.statisticsDockHeight)}px`);
    const shell = this.root.querySelector<HTMLElement>(".app-shell");
    shell?.style.setProperty("--statistics-height", `${Math.round(this.statisticsDockHeight)}px`);
    shell?.classList.toggle("statistics-docked", visible);
  }

  private async openStatistics(): Promise<void> {
    if (!this.document?.layout.frameCount) return;
    this.statisticsOpen = true;
    this.viewport.setSelectionVisible(true);
    if (this.statisticsDetached) {
      await this.openDetachedStatisticsWindow();
    } else {
      this.updateStatisticsDock();
    }
    this.syncStatisticsState();
    const result = this.statisticsResult;
    if (
      !result
      || result.snapshot.generation !== this.document.generation
      || result.snapshot.frame !== this.frame
      || JSON.stringify(result.snapshot.roi) !== JSON.stringify(this.statisticsRequestedRoi())
    ) {
      void this.requestStatistics();
    }
  }

  private async openDetachedStatisticsWindow(): Promise<void> {
    const existing = await WebviewWindow.getByLabel("statistics");
    if (existing) {
      await existing.show();
      await existing.setFocus();
      await this.emitStatisticsState();
      return;
    }
    const statisticsWindow = new WebviewWindow("statistics", {
      url: "index.html?statistics=1",
      title: t("statistics.title"),
      width: 1180,
      height: 760,
      minWidth: 760,
      minHeight: 520,
      center: true,
      resizable: true,
    });
    statisticsWindow.once("tauri://created", () => {
      void this.emitStatisticsState();
    });
    statisticsWindow.once("tauri://error", (event) => {
      this.statisticsDetached = false;
      localStorage.setItem(STATISTICS_PRESENTATION_KEY, "docked");
      this.updateStatisticsDock();
      this.reportRuntimeError(event.payload);
    });
  }

  private statisticsRequestedRoi(): ImageRect {
    const selection = this.statisticsUseSelection ? this.viewport.getSelection() : null;
    return selection ?? {
      x: 0,
      y: 0,
      width: this.document?.descriptor.width ?? 0,
      height: this.document?.descriptor.height ?? 0,
    };
  }

  private async requestStatistics(): Promise<void> {
    const info = this.document;
    if (!this.statisticsOpen || !info?.layout.frameCount) {
      this.syncStatisticsState();
      return;
    }
    const revision = ++this.statisticsRevision;
    const roi = this.statisticsRequestedRoi();
    if (
      this.statisticsResult
      && (
        this.statisticsResult.snapshot.generation !== info.generation
        || this.statisticsResult.snapshot.frame !== this.frame
        || JSON.stringify(this.statisticsResult.snapshot.roi) !== JSON.stringify(roi)
      )
    ) {
      this.statisticsResult = null;
    }
    this.statisticsLoading = true;
    this.statisticsError = null;
    this.syncStatisticsState();
    try {
      const result = await analyzeRawImage({
        generation: info.generation,
        analysisRevision: revision,
        frame: this.frame,
        roi,
      });
      if (
        revision !== this.statisticsRevision
        || this.document?.generation !== info.generation
        || this.frame !== result.snapshot.frame
      ) return;
      this.statisticsResult = result;
    } catch (error) {
      const code = backendErrorCode(error);
      if (code !== "stale_analysis" && code !== "stale_generation") {
        this.statisticsError = localizeBackendError(error).message;
      }
    } finally {
      if (revision === this.statisticsRevision) {
        this.statisticsLoading = false;
        this.syncStatisticsState();
      }
    }
  }

  private onStatisticsSelectionChange(selection: ImageRect | null): void {
    if (!this.statisticsOpen) return;
    this.statisticsUseSelection = Boolean(selection);
    this.syncStatisticsState();
    void this.requestStatistics();
  }

  private onStatisticsAction(
    action: StatisticsPanelAction,
    source: "main" | "detached" = "main",
  ): void {
    if (action === "close") {
      this.statisticsOpen = false;
      this.statisticsRevision += 1;
      void cancelRawAnalysis(this.statisticsRevision);
      this.statisticsLoading = false;
      this.viewport.setInteractionMode("pan");
      this.viewport.setSelectionVisible(false);
      this.updateStatisticsDock();
      if (source === "main") {
        void WebviewWindow.getByLabel("statistics").then((window) => window?.close());
      }
      return;
    }
    if (action === "detach") {
      this.statisticsDetached = true;
      localStorage.setItem(
        STATISTICS_PRESENTATION_KEY,
        "detached",
      );
      this.updateStatisticsDock();
      void this.openDetachedStatisticsWindow();
      this.syncStatisticsState();
      return;
    }
    if (action === "dock") {
      this.statisticsDetached = false;
      localStorage.setItem(STATISTICS_PRESENTATION_KEY, "docked");
      this.updateStatisticsDock();
      this.syncStatisticsState();
      return;
    }
    if (action === "selectRoi") {
      void getCurrentWindow().setFocus();
      this.viewport.setSelectionVisible(true);
      this.viewport.setInteractionMode("select");
      return;
    }
    if (action === "clearRoi") {
      this.statisticsUseSelection = false;
      this.viewport.clearSelection();
      return;
    }
    if (action === "useFullFrame") {
      this.statisticsUseSelection = false;
      this.syncStatisticsState();
      void this.requestStatistics();
      return;
    }
    if (action === "useSelection") {
      if (!this.viewport.getSelection()) return;
      this.statisticsUseSelection = true;
      this.syncStatisticsState();
      void this.requestStatistics();
      return;
    }
    if (action === "cancelAnalysis") {
      this.statisticsRevision += 1;
      this.statisticsLoading = false;
      void cancelRawAnalysis(this.statisticsRevision);
      this.syncStatisticsState();
    }
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    const target = event.target;
    if (
      !this.document?.layout.frameCount
      || !(target instanceof Element)
      || !target.closest("#viewport")
    ) {
      this.setCanvasContextMenuOpen(false);
      return;
    }
    this.openCanvasContextMenu(event.clientX, event.clientY);
  }

  private openCanvasContextMenu(clientX: number, clientY: number): void {
    const menu = this.get("canvas-context-menu");
    const viewportRect = this.get("viewport").getBoundingClientRect();
    menu.hidden = false;
    menu.setAttribute("aria-hidden", "false");
    const margin = 5;
    const left = Math.max(
      viewportRect.left + margin,
      Math.min(clientX, viewportRect.right - menu.offsetWidth - margin),
    );
    const top = Math.max(
      viewportRect.top + margin,
      Math.min(clientY, viewportRect.bottom - menu.offsetHeight - margin),
    );
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }

  private setCanvasContextMenuOpen(open: boolean): void {
    const menu = this.get("canvas-context-menu");
    menu.hidden = !open;
    menu.setAttribute("aria-hidden", String(!open));
  }

  private captureDefaultPath(kind: "current" | "preview"): string {
    const info = this.document;
    if (!info) return `eRAW-${kind}.png`;
    const suffix = `-frame-${this.frame + 1}-${this.displayMode}-${kind}.png`;
    return info.path.replace(/(?:\.[^\\/.]+)?$/, suffix);
  }

  private async performImageCapture(
    kind: "current" | "preview",
    destination: "save" | "copy",
  ): Promise<void> {
    if (this.imageCaptureInProgress || !this.document?.layout.frameCount) return;
    this.setCanvasContextMenuOpen(false);
    let path: string | null = null;
    if (destination === "save") {
      try {
        path = await choosePngFile(this.captureDefaultPath(kind));
      } catch (error) {
        this.reportRuntimeError(error, "capture.failed");
        return;
      }
      if (!path) return;
    }
    this.imageCaptureInProgress = true;
    this.updateCaptureMenuAvailability();
    try {
      await this.flushDescriptor();
      const generation = this.document?.generation;
      if (generation === undefined) return;
      this.showToast(
        t(kind === "current" ? "capture.generatingCurrent" : "capture.generatingPreview"),
        "busy",
        60_000,
      );
      const canvas = kind === "current"
        ? this.viewport.captureCurrentView()
        : await this.viewport.captureFullPreview();
      if (this.document?.generation !== generation) {
        this.showToast(t("capture.stale"), "error");
        return;
      }
      if (destination === "save" && path) {
        await saveCanvasPng(canvas, path);
        this.showToast(t("capture.saved"), "success");
      } else {
        await copyCanvasImage(canvas);
        this.showToast(t("capture.copied"), "success");
      }
    } catch (error) {
      const code = backendErrorCode(error);
      if (code === "stale_generation" || code === "stale_render") {
        this.showToast(t("capture.stale"), "error");
      } else {
        this.reportRuntimeError(error, "capture.failed");
      }
    } finally {
      this.imageCaptureInProgress = false;
      this.updateCaptureMenuAvailability();
    }
  }

  private updateCaptureMenuAvailability(): void {
    const disabled = this.imageCaptureInProgress || !this.document?.layout.frameCount;
    this.root.querySelectorAll<HTMLButtonElement>("[data-capture-kind][data-capture-destination]")
      .forEach((button) => { button.disabled = disabled; });
  }

  private updateDisplay(): void {
    this.viewport.setDisplay({
      mode: this.displayMode,
      processing: this.processing,
      displayMin: 0,
      displayMax: 0,
    });
  }

  private setFrame(frame: number): void {
    const count = this.document?.layout.frameCount ?? 0;
    if (!count) return;
    const nextFrame = Math.max(0, Math.min(Math.trunc(frame), count - 1));
    if (nextFrame === this.frame) return;
    this.frame = nextFrame;
    this.viewport.setFrame(this.frame);
    this.get<HTMLInputElement>("frame-input").value = String(this.frame + 1);
    this.statisticsResult = null;
    this.syncStatisticsState();
    if (this.statisticsOpen) void this.requestStatistics();
  }

  private updateSample(sample: ImagePoint | null): void {
    if (sample) this.lastSample = sample;
    this.get("pixel-status").textContent = sample ? `X ${sample.x} · Y ${sample.y}` : "X — · Y —";
  }

  private updateZoomStatus(zoom: number): void {
    this.get("zoom-status").textContent = this.formatZoom(zoom);
  }

  private updateRenderStatus(
    levelLabel: string,
    loaded: number,
    pending: number,
    timing: TileTimingStats,
  ): void {
    const status = this.get("render-status");
    status.textContent = `${levelLabel} · ${loaded} tiles · ${pending} loading`;
    const duration = (milliseconds: number) => milliseconds >= 1000
      ? `${(milliseconds / 1000).toFixed(2)} s`
      : `${milliseconds.toFixed(milliseconds >= 100 ? 0 : 1)} ms`;
    const timingHelp = timing.samples
      ? t("runtime.tileTiming", {
          samples: timing.samples,
          last: duration(timing.lastMs),
          average: duration(timing.averageMs),
          max: duration(timing.maxMs),
        })
      : t("runtime.noTileTiming");
    status.dataset.help = t("runtime.renderHelp", { timing: timingHelp });
  }

  private formatZoom(zoom: number): string {
    return `${(zoom * 100).toFixed(2)}%`;
  }

  private getZoomPercentRange(): { min: number; max: number } {
    const range = this.viewport.getZoomRange();
    return {
      min: Math.ceil(range.min * 10_000 - 1e-9) / 100,
      max: Math.floor(range.max * 10_000 + 1e-9) / 100,
    };
  }

  private resolveZoomPercent(rawValue: string): { value: number | null; adjustment: "min" | "max" | "rounded" | null } {
    if (!rawValue.trim()) return { value: null, adjustment: null };
    const inputPercent = Number(rawValue);
    if (!Number.isFinite(inputPercent)) return { value: null, adjustment: null };
    const range = this.getZoomPercentRange();
    if (inputPercent < range.min) return { value: range.min, adjustment: "min" };
    if (inputPercent > range.max) return { value: range.max, adjustment: "max" };
    const rounded = Math.round(inputPercent * 100) / 100;
    return {
      value: Math.min(range.max, Math.max(range.min, rounded)),
      adjustment: rounded === inputPercent ? null : "rounded",
    };
  }

  private updateZoomInputPreview(): void {
    const preview = this.get("zoom-effective");
    const resolved = this.resolveZoomPercent(this.get<HTMLInputElement>("zoom-input").value);
    if (resolved.value === null) {
      preview.textContent = t("runtime.invalidZoom");
      preview.dataset.state = "invalid";
      return;
    }
    if (resolved.adjustment === null) {
      preview.textContent = t("dialog.zoomContinuous");
      preview.dataset.state = "valid";
      return;
    }
    const adjustment = resolved.adjustment === "min"
      ? t("runtime.adjustMin")
      : resolved.adjustment === "max"
        ? t("runtime.adjustMax")
        : t("runtime.rounded");
    preview.textContent = t("runtime.effectiveZoom", { value: resolved.value.toFixed(2), adjustment });
    preview.dataset.state = "adjusted";
  }

  private openZoomDialog(): void {
    if (!this.document) return;
    const zoom = this.viewport.getZoom();
    const range = this.getZoomPercentRange();
    const input = this.get<HTMLInputElement>("zoom-input");
    input.value = (zoom * 100).toFixed(2);
    this.get("zoom-range").textContent = t("runtime.zoomRange", {
      min: range.min.toFixed(2),
      max: range.max.toFixed(2),
    });
    this.updateZoomInputPreview();
    this.get<HTMLDialogElement>("zoom-dialog").showModal();
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }

  private applyZoomFromDialog(): void {
    if (!this.document) return;
    const input = this.get<HTMLInputElement>("zoom-input");
    const resolved = this.resolveZoomPercent(input.value);
    if (resolved.value === null) {
      this.updateZoomInputPreview();
      input.focus();
      input.select();
      return;
    }
    input.value = resolved.value.toFixed(2);
    this.viewport.setZoom(resolved.value / 100);
    this.get<HTMLDialogElement>("zoom-dialog").close();
  }

  private openPixelLocator(): void {
    if (!this.document) return;
    const { width, height } = this.document.descriptor;
    const sample = this.lastSample
      && this.lastSample.x < width && this.lastSample.y < height
      ? this.lastSample
      : { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    const xInput = this.get<HTMLInputElement>("pixel-locator-x");
    const yInput = this.get<HTMLInputElement>("pixel-locator-y");
    xInput.max = String(width - 1);
    yInput.max = String(height - 1);
    xInput.value = String(sample.x);
    yInput.value = String(sample.y);
    this.get("pixel-locator-range").textContent = t("runtime.coordinateRange", {
      x: width - 1,
      y: height - 1,
    });
    this.get<HTMLDialogElement>("pixel-locator-dialog").showModal();
    requestAnimationFrame(() => { xInput.focus(); xInput.select(); });
  }

  private locatePixel(): void {
    if (!this.document) return;
    const xInput = this.get<HTMLInputElement>("pixel-locator-x");
    const yInput = this.get<HTMLInputElement>("pixel-locator-y");
    const x = Number(xInput.value);
    const y = Number(yInput.value);
    const { width, height } = this.document.descriptor;
    if (!Number.isInteger(x) || x < 0 || x >= width) {
      this.showToast(t("runtime.coordinateError", { axis: "X", max: width - 1 }), "error");
      xInput.focus();
      xInput.select();
      return;
    }
    if (!Number.isInteger(y) || y < 0 || y >= height) {
      this.showToast(t("runtime.coordinateError", { axis: "Y", max: height - 1 }), "error");
      yInput.focus();
      yInput.select();
      return;
    }
    const point = { x, y };
    this.lastSample = point;
    this.updateSample(point);
    this.viewport.focusPixel(point);
    this.get<HTMLDialogElement>("pixel-locator-dialog").close();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.viewport.cancelSelection()) {
      event.preventDefault();
    }
    else if (event.key === "Escape" && (!this.get("language-popover").hidden || !this.get("theme-popover").hidden || !this.get("utility-popover").hidden || !this.get("export-popover").hidden || !this.get("canvas-context-menu").hidden)) {
      event.preventDefault();
      this.setLanguageMenuOpen(false);
      this.setThemeMenuOpen(false);
      this.setUtilityMenuOpen(false);
      this.setExportMenuOpen(false);
      this.setCanvasContextMenuOpen(false);
    }
    else if (event.key === "Escape" && this.root.querySelector(".app-shell")!.classList.contains("diagnostics-open")) { event.preventDefault(); this.setDiagnosticsOpen(false); }
    else if (event.ctrlKey && event.key.toLowerCase() === "o") { event.preventDefault(); void this.openFile(); }
    else if (event.ctrlKey && event.key.toLowerCase() === "w" && this.document) {
      event.preventDefault();
      if (this.exportDialog.isOpen) this.showToast(t("runtime.closeBlockedByExport"), "error");
      else if (!this.root.querySelector("dialog[open]")) void this.closeFile();
    }
    else if (event.ctrlKey && event.key.toLowerCase() === "e" && this.document?.layout.frameCount && !this.exportDialog.isOpen) {
      event.preventDefault();
      void this.openExport("originalCfa");
    }
    else if (event.ctrlKey && event.key === "0") { event.preventDefault(); this.viewport.fit(); }
    else if (event.ctrlKey && event.key === "1") { event.preventDefault(); this.viewport.actualSize(); }
    else if (event.key === "F11") { event.preventDefault(); void this.toggleFullscreen(); }
  }

  private async openExport(target: ExportTarget): Promise<void> {
    await this.flushDescriptor();
    if (!this.document?.layout.frameCount) return;
    const cfa = this.document.descriptor.cfa;
    if (target === "remosaic" && !isQuadCfa(cfa)) return;
    if (target === "demosaic" && !isColorCfa(cfa)) return;
    this.exportDialog.open(this.document, this.frame, this.processing, target);
  }

  private async toggleFullscreen(): Promise<void> {
    const appWindow = getCurrentWindow();
    try {
      await appWindow.setFullscreen(!(await appWindow.isFullscreen()));
    } catch (error) {
      this.reportRuntimeError(error, "runtime.fullscreenFailed");
    }
  }

  private openSettingsDialog(): void {
    this.writeSettingsForm(this.settings);
    this.get<HTMLDialogElement>("settings-dialog").showModal();
  }

  private writeSettingsForm(settings: AppSettings): void {
    this.settingsFormSidebarWidth = settings.sidebarWidth;
    this.get<HTMLSelectElement>("setting-font-size").value = settings.uiFontSize;
    this.get<HTMLSelectElement>("setting-sidebar-position").value = settings.sidebarPosition;
    this.get<HTMLInputElement>("setting-reduce-motion").checked = settings.reduceMotion;
    this.get<HTMLSelectElement>("setting-open-view").value = settings.openView;
    this.get<HTMLSelectElement>("setting-wheel-speed").value = settings.wheelSpeed;
    this.get<HTMLInputElement>("setting-remember-descriptor").checked = settings.rememberDescriptor;
    this.get<HTMLSelectElement>("setting-tile-cache").value = settings.tileCache;
  }

  private saveSettingsFromDialog(): void {
    this.settings = {
      theme: this.settings.theme,
      uiFontSize: this.get<HTMLSelectElement>("setting-font-size").value as UiFontSize,
      reduceMotion: this.get<HTMLInputElement>("setting-reduce-motion").checked,
      openView: this.get<HTMLSelectElement>("setting-open-view").value as OpenView,
      rememberDescriptor: this.get<HTMLInputElement>("setting-remember-descriptor").checked,
      wheelSpeed: this.get<HTMLSelectElement>("setting-wheel-speed").value as WheelSpeed,
      tileCache: this.get<HTMLSelectElement>("setting-tile-cache").value as TileCache,
      language: this.settings.language,
      sidebarWidth: this.settingsFormSidebarWidth,
      sidebarPosition: this.get<HTMLSelectElement>("setting-sidebar-position").value as SidebarPosition,
      pixelValuesEnabled: this.settings.pixelValuesEnabled,
      pixelGridColor: this.settings.pixelGridColor,
      demosaicPixelValues: this.settings.demosaicPixelValues,
      channelRendering: this.settings.channelRendering,
      missingPixelPattern: this.settings.missingPixelPattern,
      missingPixelColor: this.settings.missingPixelColor,
    };
    this.persistSettings();
    if (this.settings.rememberDescriptor) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.descriptor));
    else localStorage.removeItem(STORAGE_KEY);
    this.applySettings();
    this.get<HTMLDialogElement>("settings-dialog").close();
    this.showToast(t("settings.saved"), "success");
  }

  private applySettings(): void {
    this.applyTheme();
    document.documentElement.dataset.uiSize = this.settings.uiFontSize;
    document.documentElement.dataset.reduceMotion = String(this.settings.reduceMotion);
    const shell = this.root.querySelector<HTMLElement>(".app-shell")!;
    shell.classList.toggle("sidebar-right", this.settings.sidebarPosition === "right");
    this.get("sidebar-resizer").setAttribute(
      "aria-label",
      `${t("sidebar.resize")} (${this.settings.sidebarPosition === "right" ? t("common.right") : t("common.left")})`,
    );
    const wheelSensitivity: Record<WheelSpeed, number> = { gentle: 0.001, standard: 0.0015, fast: 0.0022 };
    const maxTextures: Record<TileCache, number> = { compact: 128, balanced: 256, large: 512 };
    this.viewport.setPreferences({ wheelSensitivity: wheelSensitivity[this.settings.wheelSpeed], maxTextures: maxTextures[this.settings.tileCache] });
    this.viewport.setChannelRendering(this.settings.channelRendering);
    this.viewport.setPixelInspectionPreferences({
      enabled: this.settings.pixelValuesEnabled,
      gridColor: this.settings.pixelGridColor,
      demosaicValues: this.settings.demosaicPixelValues,
    });
    this.viewport.setMissingPixelAppearance({
      pattern: this.settings.missingPixelPattern,
      color: this.settings.missingPixelColor,
    });
    this.writePresentationControls();
    this.setSidebarWidth(this.settings.sidebarWidth, false);
  }

  private writePresentationControls(): void {
    this.get<HTMLSelectElement>("presentation-channel-rendering").value = this.settings.channelRendering;
    this.get<HTMLInputElement>("presentation-pixel-values").checked = this.settings.pixelValuesEnabled;
    this.get<HTMLInputElement>("presentation-pixel-grid-color").value = this.settings.pixelGridColor;
    this.get<HTMLSelectElement>("presentation-demosaic-pixel-values").value = this.settings.demosaicPixelValues;
    this.get<HTMLSelectElement>("presentation-missing-pixel-pattern").value = this.settings.missingPixelPattern;
    this.get<HTMLInputElement>("presentation-missing-pixel-color").value = this.settings.missingPixelColor;
    this.updatePresentationAvailability();
  }

  private savePresentationSettings(): void {
    this.settings.channelRendering =
      this.get<HTMLSelectElement>("presentation-channel-rendering").value as ChannelRenderingMode;
    this.settings.pixelValuesEnabled =
      this.get<HTMLInputElement>("presentation-pixel-values").checked;
    this.settings.pixelGridColor = normalizePixelGridColor(
      this.get<HTMLInputElement>("presentation-pixel-grid-color").value,
    );
    this.settings.demosaicPixelValues =
      this.get<HTMLSelectElement>("presentation-demosaic-pixel-values").value as DemosaicPixelValueMode;
    this.settings.missingPixelPattern =
      this.get<HTMLSelectElement>("presentation-missing-pixel-pattern").value as MissingPixelPattern;
    this.settings.missingPixelColor = normalizeMissingPixelColor(
      this.get<HTMLInputElement>("presentation-missing-pixel-color").value,
    );
    this.persistSettings();
    this.viewport.setChannelRendering(this.settings.channelRendering);
    this.viewport.setPixelInspectionPreferences({
      enabled: this.settings.pixelValuesEnabled,
      gridColor: this.settings.pixelGridColor,
      demosaicValues: this.settings.demosaicPixelValues,
    });
    this.viewport.setMissingPixelAppearance({
      pattern: this.settings.missingPixelPattern,
      color: this.settings.missingPixelColor,
    });
    this.updatePresentationAvailability();
  }

  private updatePresentationAvailability(): void {
    const pixelValuesEnabled = this.get<HTMLInputElement>("presentation-pixel-values").checked;
    this.get<HTMLSelectElement>("presentation-demosaic-pixel-values").disabled = !pixelValuesEnabled;
    this.get("presentation-demosaic-values-row").classList.toggle("presentation-disabled", !pixelValuesEnabled);
    const solid = this.get<HTMLSelectElement>("presentation-missing-pixel-pattern").value === "solid";
    this.get<HTMLInputElement>("presentation-missing-pixel-color").disabled = !solid;
    this.get("presentation-missing-pixel-color-row").classList.toggle("presentation-disabled", !solid);
  }

  private showToast(message: string, type: "success" | "error" | "busy", duration = 3200): void {
    const toast = this.get("toast");
    window.clearTimeout(this.toastTimer);
    toast.textContent = message.replace(/^Error:\s*/, "");
    toast.className = `toast visible ${type}`;
    this.toastTimer = window.setTimeout(() => toast.classList.remove("visible"), duration);
  }
}
