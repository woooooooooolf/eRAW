import { getCurrentWindow } from "@tauri-apps/api/window";
import erawIconUrl from "./assets/eraw-icon.svg";
import { chooseExportFile, chooseRawFile, exportDocument, openDocument, updateDescriptor } from "./api";
import { RawViewport, type ImagePoint } from "./viewport";
import type {
  BitAlignment,
  CfaPattern,
  DisplayMode,
  DocumentInfo,
  Endianness,
  ExportRequest,
  Packing,
  RawDescriptor,
} from "./types";
import { DEFAULT_DESCRIPTOR } from "./types";

const VERSION = "0.0.5";
const STORAGE_KEY = "eraw.rawDescriptor.v1";
const SETTINGS_KEY = "eraw.appSettings.v1";

type UiFontSize = "standard" | "large" | "extraLarge";
type OpenView = "fit" | "actual";
type WheelSpeed = "gentle" | "standard" | "fast";
type TileCache = "compact" | "balanced" | "large";
type AppLanguage = "system" | "zh-CN";

interface AppSettings {
  uiFontSize: UiFontSize;
  reduceMotion: boolean;
  openView: OpenView;
  rememberDescriptor: boolean;
  wheelSpeed: WheelSpeed;
  tileCache: TileCache;
  language: AppLanguage;
  sidebarWidth: number;
}

interface RuntimeDiagnostic {
  message: string;
  count: number;
  timestamp: Date;
}

const DEFAULT_SIDEBAR_WIDTH = 324;
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 560;

const DEFAULT_SETTINGS: AppSettings = {
  uiFontSize: "standard",
  reduceMotion: false,
  openView: "fit",
  rememberDescriptor: true,
  wheelSpeed: "standard",
  tileCache: "balanced",
  language: "system",
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
};

function icon(path: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
}

const icons = {
  open: icon("M4 5h6l2 2h8a2 2 0 0 1 2 2v1H7.2L4 17.4V5Zm18 7-4 8H2l4-8h16Z"),
  export: icon("M13 3v8.2l2.6-2.6L17 10l-5 5-5-5 1.4-1.4 2.6 2.6V3h2Zm-9 14h2v2h12v-2h2v4H4v-4Z"),
  fit: icon("M4 9V4h5v2H6v3H4Zm11-5h5v5h-2V6h-3V4ZM4 15h2v3h3v2H4v-5Zm14 0h2v5h-5v-2h3v-3Z"),
  actual: icon("M4 4h16v16H4V4Zm2 2v12h12V6H6Zm2 2h2v2H8V8Zm6 6h2v2h-2v-2Z"),
  settings: icon("M19.4 13a7.9 7.9 0 0 0 .1-1 7.9 7.9 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7.3 7.3 0 0 0-1.7-1L15 3.3h-4L10.7 6A7.3 7.3 0 0 0 9 7L6.5 6l-2 3.4L6.6 11a7.9 7.9 0 0 0-.1 1 7.9 7.9 0 0 0 .1 1l-2.1 1.6 2 3.4L9 17a7.3 7.3 0 0 0 1.7 1l.3 2.7h4l.3-2.7a7.3 7.3 0 0 0 1.7-1l2.5 1 2-3.4L19.4 13ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"),
  about: icon("M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-1 7h2v6h-2v-6Zm0-4h2v2h-2V7Z"),
  panel: icon("M3 4h18v16H3V4Zm2 2v12h4V6H5Zm6 0v12h8V6h-8Z"),
  warning: icon("M12 3 2 21h20L12 3Zm0 4 6.6 12H5.4L12 7Zm-1 3v5h2v-5h-2Zm0 6.5v2h2v-2h-2Z"),
};

function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let size = Math.max(0, value);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${size >= 100 || unit === 0 ? size.toFixed(0) : size.toFixed(2)} ${units[unit]}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

function descriptorsEqual(left: RawDescriptor, right: RawDescriptor): boolean {
  return (Object.keys(DEFAULT_DESCRIPTOR) as Array<keyof RawDescriptor>).every((key) => left[key] === right[key]);
}

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const value = JSON.parse(saved) as Partial<AppSettings>;
      return {
        uiFontSize: ["standard", "large", "extraLarge"].includes(value.uiFontSize ?? "") ? value.uiFontSize as UiFontSize : DEFAULT_SETTINGS.uiFontSize,
        reduceMotion: typeof value.reduceMotion === "boolean" ? value.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
        openView: ["fit", "actual"].includes(value.openView ?? "") ? value.openView as OpenView : DEFAULT_SETTINGS.openView,
        rememberDescriptor: typeof value.rememberDescriptor === "boolean" ? value.rememberDescriptor : DEFAULT_SETTINGS.rememberDescriptor,
        wheelSpeed: ["gentle", "standard", "fast"].includes(value.wheelSpeed ?? "") ? value.wheelSpeed as WheelSpeed : DEFAULT_SETTINGS.wheelSpeed,
        tileCache: ["compact", "balanced", "large"].includes(value.tileCache ?? "") ? value.tileCache as TileCache : DEFAULT_SETTINGS.tileCache,
        language: ["system", "zh-CN"].includes(value.language ?? "") ? value.language as AppLanguage : DEFAULT_SETTINGS.language,
        sidebarWidth: Number.isFinite(value.sidebarWidth) ? Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Math.trunc(value.sidebarWidth!))) : DEFAULT_SETTINGS.sidebarWidth,
      };
    }
  } catch { /* 使用安全默认值 */ }
  return { ...DEFAULT_SETTINGS };
}

function loadDescriptor(remember: boolean): RawDescriptor {
  if (!remember) return { ...DEFAULT_DESCRIPTOR };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_DESCRIPTOR, ...JSON.parse(saved) as Partial<RawDescriptor> };
  } catch { /* 使用安全默认值 */ }
  return { ...DEFAULT_DESCRIPTOR };
}

export class ErawApp {
  private readonly root: HTMLElement;
  private readonly viewport: RawViewport;
  private settings = loadSettings();
  private descriptor = loadDescriptor(this.settings.rememberDescriptor);
  private document: DocumentInfo | null = null;
  private frame = 0;
  private displayMode: DisplayMode = "bayer";
  private committing = false;
  private commitRevision = 0;
  private fullscreen = false;
  private toastTimer = 0;
  private sidebarWidth = this.settings.sidebarWidth;
  private sidebarResizeStartX = 0;
  private sidebarResizeStartWidth = 0;
  private settingsFormSidebarWidth = this.settings.sidebarWidth;
  private runtimeDiagnostics: RuntimeDiagnostic[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = this.template();
    this.writeDescriptor(this.descriptor);
    this.viewport = new RawViewport(this.get("viewport"), {
      onZoomChange: (zoom) => { this.get("zoom-status").textContent = `${(zoom * 100).toFixed(zoom < 0.1 ? 2 : 1)}%`; },
      onSampleChange: (sample) => this.updateSample(sample),
      onRenderStats: (level, loaded, pending) => { this.get("render-status").textContent = `L${level} · ${loaded} tiles${pending ? ` · ${pending} loading` : ""}`; },
      onError: (message) => this.reportRuntimeError(message),
    });
    this.applySettings();
    this.bindEvents();
    this.updateDocumentUi();
  }

  private get<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = this.root.querySelector<T>(`#${id}`);
    if (!element) throw new Error(`缺少界面元素 #${id}`);
    return element;
  }

  private template(): string {
    return `
      <div class="app-shell">
        <header class="topbar">
          <div class="toolbar primary-actions">
            <button id="open-button" class="tool-button accent">${icons.open}<span>打开</span><kbd>Ctrl O</kbd></button>
            <button id="export-button" class="tool-button" disabled>${icons.export}<span>导出</span><kbd>Ctrl E</kbd></button>
          </div>
          <div class="toolbar display-modes" role="group" aria-label="显示模式">
            <button data-mode="raw">RAW 强度</button>
            <button class="active" data-mode="bayer">Bayer 点阵</button>
            <button data-mode="demosaic">Demosaic</button>
            <div class="channel-menu">
              <select id="channel-mode" aria-label="通道显示">
                <option value="bayer">全部通道</option><option value="red">R 平面</option><option value="green">G 平面</option><option value="blue">B 平面</option>
              </select>
            </div>
          </div>
          <div class="toolbar view-actions">
            <button id="fit-button" class="icon-button" title="适应窗口 (Ctrl+0)">${icons.fit}</button>
            <button id="actual-button" class="icon-button" title="实际像素 (Ctrl+1)">${icons.actual}</button>
            <button id="panel-button" class="icon-button active" title="显示或隐藏参数面板">${icons.panel}</button>
            <button id="settings-button" class="icon-button" title="设置">${icons.settings}</button>
            <button id="about-button" class="icon-button" title="关于 eRAW">${icons.about}</button>
          </div>
        </header>

        <div class="workspace">
          <aside class="sidebar" id="sidebar">
            <div class="sidebar-scroll">
              <section class="parameter-section open">
                <button class="section-title"><span>图像格式</span><i>−</i></button>
                <div class="section-content field-grid">
                  ${this.dimensionField()}
                  ${this.selectField("bitDepth", "位深", `<option value="8">8 bit</option><option value="9">9 bit</option><option value="10">10 bit</option><option value="11">11 bit</option><option value="12">12 bit</option><option value="13">13 bit</option><option value="14">14 bit</option><option value="15">15 bit</option><option value="16">16 bit</option>`)}
                  ${this.selectField("packing", "存储方式", `<option value="unpacked8">Unpacked 8</option><option value="unpacked16">Unpacked 16</option><option value="mipiRaw10">MIPI RAW10</option><option value="mipiRaw12">MIPI RAW12</option><option value="mipiRaw14">MIPI RAW14</option>`)}
                  ${this.segmentedField("endianness", "字节序", [["little", "Little"], ["big", "Big"]])}
                  ${this.segmentedField("bitAlignment", "有效位位置", [["lsb", "低位 LSB"], ["msb", "高位 MSB"]])}
                  ${this.selectField("cfa", "CFA 排列", `<option value="MONO">Mono</option><option value="RGGB">RGGB</option><option value="BGGR">BGGR</option><option value="GBRG">GBRG</option><option value="GRBG">GRBG</option>`)}
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
            <div class="frame-strip" id="frame-strip">
              <button id="first-frame" title="第一帧">|‹</button><button id="previous-frame" title="上一帧">‹</button>
              <div class="frame-counter"><span>FRAME</span><input id="frame-input" type="number" min="1" value="1"/><b>/</b><strong id="frame-total">0</strong></div>
              <button id="next-frame" title="下一帧">›</button><button id="last-frame" title="最后一帧">›|</button>
            </div>
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
          <i></i><span id="file-status" class="file-status">未打开文件</span><div class="status-spacer"></div>
          <span id="pixel-status">X — · Y —</span><i></i><span id="render-status">WebGL2 ready</span><i></i><span id="zoom-status">100.0%</span>
        </footer>
        <div class="toast" id="toast" role="status"></div>
        <div class="parameter-tooltip" id="parameter-tooltip" role="tooltip"></div>

        ${this.exportDialogTemplate()}
        ${this.settingsDialogTemplate()}
        ${this.aboutDialogTemplate()}
      </div>`;
  }

  private dimensionField(): string {
    return `<div class="parameter-row dimension-row"><span class="field-label" data-help="${this.parameterHelp("dimensions")}">有效分辨率</span><div class="dimension-control">
      <div class="number-input"><input id="descriptor-width" data-field="width" type="number" min="1" max="100000" step="1" aria-label="有效宽度"/></div>
      <i>×</i>
      <div class="number-input"><input id="descriptor-height" data-field="height" type="number" min="1" max="100000" step="1" aria-label="有效高度"/></div>
    </div></div>`;
  }

  private selectField(field: string, label: string, options: string): string {
    return `<div class="parameter-row"><span class="field-label" data-help="${this.parameterHelp(field)}">${label}</span><select id="descriptor-${field}" data-field="${field}" aria-label="${label}">${options}</select></div>`;
  }

  private segmentedField(field: string, label: string, options: Array<[string, string]>): string {
    const buttons = options.map(([value, text]) => `<button type="button" data-value="${value}" aria-pressed="false">${text}</button>`).join("");
    return `<div class="parameter-row"><span class="field-label" id="${field}-label" data-help="${this.parameterHelp(field)}">${label}</span><div class="segmented-control" data-field="${field}" role="group" aria-labelledby="${field}-label">${buttons}</div></div>`;
  }

  private numberField(field: string, label: string, unit: string, min: number, max?: number, hint?: string, descriptorField = true, adjustable = false): string {
    const inputId = descriptorField ? `descriptor-${field}` : field;
    const input = `<div class="number-input"><input id="${inputId}" type="number" ${descriptorField ? `data-field="${field}"` : ""} min="${min}" ${max === undefined ? "" : `max="${max}"`} step="1" ${hint ? `placeholder="${hint}"` : ""}/><b>${unit}</b></div>`;
    const control = adjustable ? `<div class="stepper-control"><button type="button" data-step-target="${field}" data-step="-1" aria-label="减小${label}">−</button>${input}<button type="button" data-step-target="${field}" data-step="1" aria-label="增大${label}">+</button></div>` : input;
    return `<div class="parameter-row"><span class="field-label" data-help="${this.parameterHelp(field)}">${label}</span>${control}</div>`;
  }

  private parameterHelp(field: string): string {
    const descriptions: Record<string, string> = {
      dimensions: "图像中可见的有效像素宽度和高度，不包含每行或每帧末尾的填充数据。",
      bitDepth: "每个像素实际使用的有效位数。9/11/13/15 bit 数据通常存放在 16-bit 容器中。",
      packing: "RAW 像素在文件中的字节排列方式；MIPI 格式会将多个像素紧凑打包。",
      endianness: "Unpacked 多字节像素在文件中的字节顺序；MIPI packed 格式不使用此设置。",
      bitAlignment: "有效像素位在 Unpacked 容器中靠低位或靠高位存放。",
      cfa: "传感器彩色滤光阵列的 2×2 排列；Mono 表示单色传感器。",
      headerOffset: "第一帧 RAW 像素数据相对于文件开头的字节偏移。",
      rowAlignment: "自动行步长使用的字节对齐值；仅在显式行步长为 0 时生效。",
      rowStride: "相邻两行起点之间的字节距离；0 表示根据有效行大小和行对齐自动计算。",
      frameAlignment: "自动帧步长使用的字节对齐值；仅在显式帧步长为 0 时生效。",
      frameStride: "相邻两帧起点之间的字节距离；0 表示根据帧数据大小和帧对齐自动计算。",
    };
    return escapeHtml(descriptions[field] ?? "");
  }

  private exportDialogTemplate(): string {
    return `<dialog id="export-dialog" class="modal export-modal">
      <form method="dialog"><header><div><small>DETERMINISTIC CONVERSION</small><h2>导出 RAW 数据</h2></div><button value="cancel" class="dialog-close">×</button></header>
      <div class="dialog-body">
        <section><h3>有效区域</h3><div class="export-grid">
          ${this.exportNumber("crop-x", "起点 X", 0)}${this.exportNumber("crop-y", "起点 Y", 0)}${this.exportNumber("crop-width", "宽度", 1)}${this.exportNumber("crop-height", "高度", 1)}
        </div><div class="phase-note">输出 CFA：<strong id="export-cfa">—</strong><span>奇数坐标裁剪会自动改变 CFA 相位</span></div></section>
        <section><h3>输出编码</h3><div class="export-grid">
          <label><span>存储方式</span><select id="export-packing"><option value="unpacked8">Unpacked 8</option><option value="unpacked16">Unpacked 16</option><option value="mipiRaw10">MIPI RAW10</option><option value="mipiRaw12">MIPI RAW12</option><option value="mipiRaw14">MIPI RAW14</option></select></label>
          <label><span>位深</span><select id="export-depth"><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option></select></label>
          <label><span>字节序</span><select id="export-endian"><option value="little">Little endian</option><option value="big">Big endian</option></select></label>
          <label><span>有效位位置</span><select id="export-bit-alignment"><option value="lsb">容器低位 LSB</option><option value="msb">容器高位 MSB</option></select></label>
          ${this.exportNumber("export-row-alignment", "行对齐", 1)}${this.exportNumber("export-frame-alignment", "帧对齐", 1)}
          <label><span>像素值映射</span><select id="export-mapping"><option value="preserve">保持数值，超限裁剪</option><option value="scaleFullRange">按满量程缩放</option></select></label>
          <label><span>帧范围</span><select id="export-frames"><option value="current">仅当前帧</option><option value="all">全部帧</option></select></label>
        </div></section>
      </div>
      <footer><p id="export-summary">输出不包含源文件头，仅包含所选 RAW 帧。</p><div><button value="cancel" class="secondary-button">取消</button><button id="confirm-export" value="default" class="primary-button">选择位置并导出</button></div></footer></form>
    </dialog>`;
  }

  private exportNumber(id: string, label: string, min: number): string {
    return `<label><span>${label}</span><div class="number-input"><input id="${id}" type="number" min="${min}" step="1"/><b>${id.includes("alignment") ? "B" : "px"}</b></div></label>`;
  }

  private aboutDialogTemplate(): string {
    return `<dialog id="about-dialog" class="modal about-modal"><form method="dialog">
      <button value="cancel" class="dialog-close floating">×</button>
      <div class="about-hero"><img src="${erawIconUrl}" alt="eRAW"/><div><small>RAW SENSOR LAB</small><h2>eRAW</h2><p>V${VERSION}</p></div></div>
      <div class="about-copy"><p>面向 SoC 与图像传感器适配工作的 RAW 图像查看、诊断与格式转换工具。</p><dl><div><dt>作者</dt><dd>eRAW contributors</dd></div><div><dt>许可证</dt><dd>GNU GPLv3 or later</dd></div><div><dt>渲染</dt><dd>WebGL2 tiled viewport</dd></div><div><dt>平台</dt><dd>Windows · Tauri 2</dd></div></dl><p class="warranty">本程序为自由软件，不提供任何形式的担保。完整许可条款随源代码和安装包提供。</p></div>
      <footer><button value="cancel" class="primary-button">完成</button></footer>
    </form></dialog>`;
  }

  private settingsDialogTemplate(): string {
    return `<dialog id="settings-dialog" class="modal settings-modal"><form method="dialog">
      <header><div><small>APPLICATION PREFERENCES</small><h2>设置</h2></div><button value="cancel" class="dialog-close">×</button></header>
      <div class="settings-body">
        <section class="settings-group"><div class="settings-heading"><h3>外观</h3><p>调整界面文字与动态效果，不改变 RAW 图像的显示比例。</p></div>
          <label class="settings-row"><div><strong>界面字号</strong><span>高分辨率显示器推荐使用“大”或“特大”</span></div><select id="setting-font-size"><option value="standard">标准</option><option value="large">大</option><option value="extraLarge">特大</option></select></label>
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
        <section class="settings-group"><div class="settings-heading"><h3>语言</h3><p>当前版本内置简体中文；此入口将用于后续语言包与区域格式。</p></div>
          <label class="settings-row"><div><strong>界面语言</strong><span>“跟随系统”在当前版本回退为简体中文</span></div><select id="setting-language"><option value="system">跟随系统</option><option value="zh-CN">简体中文</option></select></label>
        </section>
      </div>
      <footer><button id="reset-settings" type="button" class="text-button">恢复默认设置</button><span class="footer-spacer"></span><button value="cancel" class="secondary-button">取消</button><button id="confirm-settings" type="button" class="primary-button">应用</button></footer>
    </form></dialog>`;
  }

  private bindEvents(): void {
    this.get("open-button").addEventListener("click", () => void this.openFile());
    this.get("empty-open-button").addEventListener("click", () => void this.openFile());
    this.get<HTMLButtonElement>("export-button").addEventListener("click", () => this.openExportDialog());
    this.get("fit-button").addEventListener("click", () => this.viewport.fit());
    this.get("actual-button").addEventListener("click", () => this.viewport.actualSize());
    this.get("panel-button").addEventListener("click", () => {
      this.root.querySelector(".app-shell")!.classList.toggle("panel-hidden");
      this.get("panel-button").classList.toggle("active");
    });
    this.get("settings-button").addEventListener("click", () => this.openSettingsDialog());
    this.get("about-button").addEventListener("click", () => this.get<HTMLDialogElement>("about-dialog").showModal());
    this.root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.addEventListener("click", () => this.setDisplayMode(button.dataset.mode as DisplayMode)));
    this.get<HTMLSelectElement>("channel-mode").addEventListener("change", (event) => this.setDisplayMode((event.currentTarget as HTMLSelectElement).value as DisplayMode));
    this.root.querySelectorAll<HTMLElement>("[data-field]").forEach((element) => {
      if (element instanceof HTMLSelectElement) element.addEventListener("change", () => {
        this.synchronizePackingAndDepth(element.dataset.field ?? "");
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
    this.bindParameterHelp();
    this.root.querySelectorAll<HTMLButtonElement>(".section-title").forEach((button) => button.addEventListener("click", () => {
      const section = button.closest(".parameter-section")!;
      section.classList.toggle("open");
      button.querySelector("i")!.textContent = section.classList.contains("open") ? "−" : "+";
    }));
    this.get("status-warning").addEventListener("click", () => this.toggleDiagnostics());
    this.get("close-diagnostics").addEventListener("click", () => this.setDiagnosticsOpen(false));
    this.bindSidebarResize();
    this.get("first-frame").addEventListener("click", () => this.setFrame(0));
    this.get("previous-frame").addEventListener("click", () => this.setFrame(this.frame - 1));
    this.get("next-frame").addEventListener("click", () => this.setFrame(this.frame + 1));
    this.get("last-frame").addEventListener("click", () => this.setFrame((this.document?.layout.frameCount ?? 1) - 1));
    this.get<HTMLInputElement>("frame-input").addEventListener("change", (event) => this.setFrame(Number((event.currentTarget as HTMLInputElement).value) - 1));
    this.get("confirm-export").addEventListener("click", (event) => { event.preventDefault(); void this.performExport(); });
    this.get("confirm-settings").addEventListener("click", () => this.saveSettingsFromDialog());
    this.get("reset-settings").addEventListener("click", () => this.writeSettingsForm(DEFAULT_SETTINGS));
    ["crop-x", "crop-y", "crop-width", "crop-height"].forEach((id) => this.get<HTMLInputElement>(id).addEventListener("input", () => this.updateExportPhase()));
    this.get<HTMLSelectElement>("export-packing").addEventListener("change", (event) => {
      const packing = (event.currentTarget as HTMLSelectElement).value;
      if (packing === "mipiRaw10") this.get<HTMLSelectElement>("export-depth").value = "10";
      if (packing === "mipiRaw12") this.get<HTMLSelectElement>("export-depth").value = "12";
      if (packing === "mipiRaw14") this.get<HTMLSelectElement>("export-depth").value = "14";
      if (packing === "unpacked8") this.get<HTMLSelectElement>("export-depth").value = "8";
    });
    window.addEventListener("keydown", (event) => this.onKeyDown(event));
    window.addEventListener("resize", () => this.setSidebarWidth(this.settings.sidebarWidth, false));
  }

  private synchronizePackingAndDepth(changedField: string): void {
    const depth = this.root.querySelector<HTMLSelectElement>('[data-field="bitDepth"]')!;
    const packing = this.root.querySelector<HTMLSelectElement>('[data-field="packing"]')!;
    if (changedField === "bitDepth" && [9, 11, 13, 15].includes(Number(depth.value))) {
      packing.value = "unpacked16";
      return;
    }
    if (changedField !== "packing") return;
    const fixedDepth: Partial<Record<Packing, string>> = { unpacked8: "8", mipiRaw10: "10", mipiRaw12: "12", mipiRaw14: "14" };
    const value = fixedDepth[packing.value as Packing];
    if (value) depth.value = value;
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
    this.root.querySelectorAll<HTMLElement>(".field-label[data-help]").forEach((label) => {
      label.addEventListener("pointerenter", (event) => {
        hide();
        pointerX = event.clientX;
        pointerY = event.clientY;
        showTimer = window.setTimeout(() => {
          tooltip.textContent = label.dataset.help ?? "";
          tooltip.classList.add("visible");
          const margin = 12;
          const x = Math.min(window.innerWidth - tooltip.offsetWidth - margin, pointerX + 14);
          const y = Math.min(window.innerHeight - tooltip.offsetHeight - margin, pointerY + 18);
          tooltip.style.left = `${Math.max(margin, x)}px`;
          tooltip.style.top = `${Math.max(margin, y)}px`;
          showTimer = 0;
        }, 500);
      });
      label.addEventListener("pointermove", move);
      label.addEventListener("pointerleave", hide);
    });
  }

  private async openFile(): Promise<void> {
    try {
      const path = await chooseRawFile();
      if (!path) return;
      this.showToast("正在映射并分析 RAW 文件…", "busy");
      const info = await openDocument(path, this.readDescriptor());
      this.document = info;
      this.descriptor = info.descriptor;
      this.frame = 0;
      this.viewport.setDocument(info);
      if (this.settings.openView === "actual") this.viewport.actualSize();
      this.updateDocumentUi();
      this.showToast(`已打开 ${info.name}`, "success");
    } catch (error) {
      this.reportRuntimeError(String(error));
    }
  }

  private readDescriptor(): RawDescriptor {
    const number = (field: string) => {
      const value = Number(this.descriptorFieldValue(field));
      return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    };
    const value = <T extends string>(field: string) => this.descriptorFieldValue(field) as T;
    return {
      width: number("width"), height: number("height"), bitDepth: Number(value("bitDepth")),
      packing: value<Packing>("packing"), endianness: value<Endianness>("endianness"), bitAlignment: value<BitAlignment>("bitAlignment"), cfa: value<CfaPattern>("cfa"),
      rowAlignment: Math.max(1, number("rowAlignment")), rowStride: number("rowStride"), frameAlignment: Math.max(1, number("frameAlignment")), frameStride: number("frameStride"), headerOffset: number("headerOffset"),
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
            this.updateDocumentUi();
          } catch (error) {
            this.reportRuntimeError(String(error));
          }
        }
        if (revision === this.commitRevision) break;
      }
    } finally {
      this.committing = false;
    }
  }

  private updateDocumentUi(): void {
    const info = this.document;
    const emptyState = this.get("empty-state");
    emptyState.classList.toggle("hidden", Boolean(info));
    emptyState.setAttribute("aria-hidden", String(Boolean(info)));
    this.get<HTMLButtonElement>("empty-open-button").disabled = Boolean(info);
    this.get<HTMLButtonElement>("export-button").disabled = !info;
    const fileStatus = this.get("file-status");
    fileStatus.textContent = info?.path ?? "未打开文件";
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
    const warningMarkup = warnings.map((warning) => `<div class="warning-item ${warning.severity}"><span></span><div><strong>${warning.severity === "error" ? "错误" : warning.severity === "warning" ? "警告" : "信息"}<small>布局诊断</small></strong><p>${escapeHtml(warning.message)}</p></div></div>`);
    const runtimeMarkup = this.runtimeDiagnostics.map((diagnostic) => `<div class="warning-item error runtime"><span></span><div><strong>运行时错误<small>${diagnostic.timestamp.toLocaleTimeString("zh-CN", { hour12: false })}${diagnostic.count > 1 ? ` · 重复 ${diagnostic.count} 次` : ""}</small></strong><p>${escapeHtml(diagnostic.message)}</p></div></div>`);
    const list = this.get("diagnostics-list");
    const entries = [...runtimeMarkup, ...warningMarkup];
    list.innerHTML = entries.length ? entries.join("") : `<div class="no-warning">${this.document ? "参数与文件布局匹配，未发现异常" : "打开文件后显示布局诊断与运行时错误"}</div>`;
    const relevant = warnings.filter((warning) => warning.severity !== "info");
    const issueCount = relevant.length + this.runtimeDiagnostics.length;
    const errorPresent = this.runtimeDiagnostics.length > 0 || relevant.some((warning) => warning.severity === "error");
    const count = this.get("diagnostics-count");
    count.textContent = String(issueCount);
    count.toggleAttribute("hidden", issueCount === 0);
    this.get("diagnostics-summary").textContent = issueCount ? `${issueCount} 项需要注意` : this.document ? "当前数据布局正常" : "等待文件";
    const status = this.get("status-warning");
    status.className = `status-warning ${errorPresent ? "error" : relevant.length ? "warning" : "ok"}`;
  }

  private reportRuntimeError(message: string, duration = 5000): void {
    const normalized = message.replace(/^Error:\s*/, "").trim();
    const existing = this.runtimeDiagnostics.find((diagnostic) => diagnostic.message === normalized);
    if (existing) {
      existing.count += 1;
      existing.timestamp = new Date();
      this.runtimeDiagnostics = [existing, ...this.runtimeDiagnostics.filter((diagnostic) => diagnostic !== existing)];
    } else {
      this.runtimeDiagnostics.unshift({ message: normalized, count: 1, timestamp: new Date() });
      this.runtimeDiagnostics = this.runtimeDiagnostics.slice(0, 50);
    }
    this.renderDiagnostics();
    this.showToast(normalized, "error", duration);
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
      if (resizer.hasPointerCapture(event.pointerId)) this.setSidebarWidth(this.sidebarResizeStartWidth + event.clientX - this.sidebarResizeStartX, false);
    });
    resizer.addEventListener("pointerup", stop);
    resizer.addEventListener("pointercancel", stop);
    resizer.addEventListener("dblclick", () => {
      this.setSidebarWidth(DEFAULT_SIDEBAR_WIDTH, true);
    });
    resizer.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") return;
      event.preventDefault();
      const next = event.key === "Home" ? DEFAULT_SIDEBAR_WIDTH : this.sidebarWidth + (event.key === "ArrowLeft" ? -16 : 16);
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

  private setDisplayMode(mode: DisplayMode): void {
    this.displayMode = mode;
    this.root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    if (["red", "green", "blue"].includes(mode)) this.get<HTMLSelectElement>("channel-mode").value = mode;
    else this.get<HTMLSelectElement>("channel-mode").value = "bayer";
    this.updateDisplay();
  }

  private updateDisplay(): void {
    this.viewport.setDisplay({
      mode: this.displayMode,
      displayMin: 0,
      displayMax: 0,
    });
  }

  private setFrame(frame: number): void {
    const count = this.document?.layout.frameCount ?? 0;
    if (!count) return;
    this.frame = Math.max(0, Math.min(Math.trunc(frame), count - 1));
    this.viewport.setFrame(this.frame);
    this.get<HTMLInputElement>("frame-input").value = String(this.frame + 1);
  }

  private updateSample(sample: ImagePoint | null): void {
    this.get("pixel-status").textContent = sample ? `X ${sample.x} · Y ${sample.y}` : "X — · Y —";
  }

  private openExportDialog(): void {
    if (!this.document) return;
    this.get<HTMLInputElement>("crop-x").value = "0";
    this.get<HTMLInputElement>("crop-y").value = "0";
    this.get<HTMLInputElement>("crop-width").value = String(this.document.descriptor.width);
    this.get<HTMLInputElement>("crop-height").value = String(this.document.descriptor.height);
    this.get<HTMLSelectElement>("export-packing").value = this.document.descriptor.packing;
    this.get<HTMLSelectElement>("export-depth").value = String(this.document.descriptor.bitDepth);
    this.get<HTMLSelectElement>("export-endian").value = this.document.descriptor.endianness;
    this.get<HTMLSelectElement>("export-bit-alignment").value = this.document.descriptor.bitAlignment;
    this.get<HTMLInputElement>("export-row-alignment").value = "1";
    this.get<HTMLInputElement>("export-frame-alignment").value = "1";
    this.updateExportPhase();
    this.get<HTMLDialogElement>("export-dialog").showModal();
  }

  private shiftedCfa(cfa: CfaPattern, x: number, y: number): CfaPattern {
    if (cfa === "MONO") return cfa;
    const grid: Record<CfaPattern, CfaPattern[][]> = {
      MONO: [["MONO"]], RGGB: [["RGGB", "GRBG"], ["GBRG", "BGGR"]], BGGR: [["BGGR", "GBRG"], ["GRBG", "RGGB"]],
      GBRG: [["GBRG", "BGGR"], ["RGGB", "GRBG"]], GRBG: [["GRBG", "RGGB"], ["BGGR", "GBRG"]],
    };
    return grid[cfa][Math.abs(y) % 2][Math.abs(x) % 2];
  }

  private updateExportPhase(): void {
    if (!this.document) return;
    const x = Number(this.get<HTMLInputElement>("crop-x").value) || 0;
    const y = Number(this.get<HTMLInputElement>("crop-y").value) || 0;
    this.get("export-cfa").textContent = this.shiftedCfa(this.document.descriptor.cfa, x, y);
  }

  private async performExport(): Promise<void> {
    if (!this.document) return;
    const defaultPath = this.document.path.replace(/(?:\.[^\\/.]+)?$/, "_extracted.raw");
    try {
      const path = await chooseExportFile(defaultPath);
      if (!path) return;
      const num = (id: string) => Math.max(0, Math.trunc(Number(this.get<HTMLInputElement>(id).value) || 0));
      const request: ExportRequest = {
        path, currentFrame: this.frame, frameSelection: this.get<HTMLSelectElement>("export-frames").value as "current" | "all",
        cropX: num("crop-x"), cropY: num("crop-y"), cropWidth: num("crop-width"), cropHeight: num("crop-height"),
        packing: this.get<HTMLSelectElement>("export-packing").value as Packing, bitDepth: Number(this.get<HTMLSelectElement>("export-depth").value),
        endianness: this.get<HTMLSelectElement>("export-endian").value as Endianness, bitAlignment: this.get<HTMLSelectElement>("export-bit-alignment").value as BitAlignment,
        rowAlignment: Math.max(1, num("export-row-alignment")), frameAlignment: Math.max(1, num("export-frame-alignment")),
        valueMapping: this.get<HTMLSelectElement>("export-mapping").value as "preserve" | "scaleFullRange",
      };
      this.showToast("正在转换并写入 RAW 数据…", "busy", 15000);
      const result = await exportDocument(request);
      this.get<HTMLDialogElement>("export-dialog").close();
      const clipped = result.clippedValues ? `，${result.clippedValues} 个像素被裁剪` : "";
      this.showToast(`已导出 ${result.framesWritten} 帧 · ${formatBytes(result.bytesWritten)} · ${result.outputCfa}${clipped}`, "success", 6000);
    } catch (error) {
      this.reportRuntimeError(String(error), 6000);
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.root.querySelector(".app-shell")!.classList.contains("diagnostics-open")) { event.preventDefault(); this.setDiagnosticsOpen(false); }
    else if (event.ctrlKey && event.key.toLowerCase() === "o") { event.preventDefault(); void this.openFile(); }
    else if (event.ctrlKey && event.key.toLowerCase() === "e" && this.document) { event.preventDefault(); this.openExportDialog(); }
    else if (event.ctrlKey && event.key === "0") { event.preventDefault(); this.viewport.fit(); }
    else if (event.ctrlKey && event.key === "1") { event.preventDefault(); this.viewport.actualSize(); }
    else if (event.key === "F11") { event.preventDefault(); void this.toggleFullscreen(); }
  }

  private async toggleFullscreen(): Promise<void> {
    this.fullscreen = !this.fullscreen;
    try { await getCurrentWindow().setFullscreen(this.fullscreen); } catch { this.root.querySelector(".app-shell")!.classList.toggle("ui-fullscreen", this.fullscreen); }
  }

  private openSettingsDialog(): void {
    this.writeSettingsForm(this.settings);
    this.get<HTMLDialogElement>("settings-dialog").showModal();
  }

  private writeSettingsForm(settings: AppSettings): void {
    this.settingsFormSidebarWidth = settings.sidebarWidth;
    this.get<HTMLSelectElement>("setting-font-size").value = settings.uiFontSize;
    this.get<HTMLInputElement>("setting-reduce-motion").checked = settings.reduceMotion;
    this.get<HTMLSelectElement>("setting-open-view").value = settings.openView;
    this.get<HTMLSelectElement>("setting-wheel-speed").value = settings.wheelSpeed;
    this.get<HTMLInputElement>("setting-remember-descriptor").checked = settings.rememberDescriptor;
    this.get<HTMLSelectElement>("setting-tile-cache").value = settings.tileCache;
    this.get<HTMLSelectElement>("setting-language").value = settings.language;
  }

  private saveSettingsFromDialog(): void {
    this.settings = {
      uiFontSize: this.get<HTMLSelectElement>("setting-font-size").value as UiFontSize,
      reduceMotion: this.get<HTMLInputElement>("setting-reduce-motion").checked,
      openView: this.get<HTMLSelectElement>("setting-open-view").value as OpenView,
      rememberDescriptor: this.get<HTMLInputElement>("setting-remember-descriptor").checked,
      wheelSpeed: this.get<HTMLSelectElement>("setting-wheel-speed").value as WheelSpeed,
      tileCache: this.get<HTMLSelectElement>("setting-tile-cache").value as TileCache,
      language: this.get<HTMLSelectElement>("setting-language").value as AppLanguage,
      sidebarWidth: this.settingsFormSidebarWidth,
    };
    this.persistSettings();
    if (this.settings.rememberDescriptor) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.descriptor));
    else localStorage.removeItem(STORAGE_KEY);
    this.applySettings();
    this.get<HTMLDialogElement>("settings-dialog").close();
    this.showToast("设置已保存", "success");
  }

  private applySettings(): void {
    document.documentElement.dataset.uiSize = this.settings.uiFontSize;
    document.documentElement.dataset.reduceMotion = String(this.settings.reduceMotion);
    const wheelSensitivity: Record<WheelSpeed, number> = { gentle: 0.001, standard: 0.0015, fast: 0.0022 };
    const maxTextures: Record<TileCache, number> = { compact: 128, balanced: 256, large: 512 };
    this.viewport.setPreferences({ wheelSensitivity: wheelSensitivity[this.settings.wheelSpeed], maxTextures: maxTextures[this.settings.tileCache] });
    this.setSidebarWidth(this.settings.sidebarWidth, false);
  }

  private showToast(message: string, type: "success" | "error" | "busy", duration = 3200): void {
    const toast = this.get("toast");
    window.clearTimeout(this.toastTimer);
    toast.textContent = message.replace(/^Error:\s*/, "");
    toast.className = `toast visible ${type}`;
    this.toastTimer = window.setTimeout(() => toast.classList.remove("visible"), duration);
  }
}
