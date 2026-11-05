import { formatDateTime, t } from "./i18n";
import { LATEST_RELEASE_URL, updateCheckMessage, type UpdateCheckStatus } from "./update-check";

export function aboutDialogTemplate(version: string, buildTime: string, iconUrl: string): string {
  return `<dialog id="about-dialog" class="modal about-modal"><form method="dialog">
    <button value="cancel" class="dialog-close floating">×</button>
    <div class="about-hero"><img src="${iconUrl}" alt="eRAW"/><div><h2 class="about-product-name">eRAW</h2><p>V${version}</p><time id="about-build-time" datetime="${buildTime}">${t("about.builtAt", { time: formatDateTime(buildTime) })}</time></div></div>
    <div class="about-copy">
      <div class="about-credits">
        <div><span>产品设计</span><strong>凌净清河</strong></div>
        <div><span>工程实现</span><strong>Codex (GPT-5.6 Sol/GPT-6.1 Sol)</strong></div>
      </div>
      <a id="about-repository" class="about-entry" href="https://github.com/woooooooooolf/eRAW" target="_blank" rel="noopener noreferrer"><strong>GitHub</strong><span class="about-entry-detail">github.com/woooooooooolf/eRAW</span><b aria-hidden="true">↗</b></a>
      <button id="about-license" type="button" class="about-entry" aria-haspopup="dialog"><strong>软件许可证</strong><span class="about-entry-detail">GPL-3.0-or-later</span><b aria-hidden="true">›</b></button>
      <button id="open-source-components" type="button" class="about-entry" aria-haspopup="dialog"><strong>开源组件</strong><span class="about-entry-detail">第三方许可证</span><b aria-hidden="true">›</b></button>
    </div>
    <div id="update-check-result" class="about-update-result" role="status" aria-live="polite" hidden>
      <span id="update-check-message"></span>
      <div class="about-update-links">
        <a id="update-download" data-i18n="update.download" target="_blank" rel="noopener noreferrer" hidden>下载发布包 ↗</a>
        <a id="update-release" data-i18n="update.release" href="${LATEST_RELEASE_URL}" target="_blank" rel="noopener noreferrer" hidden>前往 GitHub ↗</a>
      </div>
    </div>
    <footer><button id="check-updates" type="button" class="secondary-button">${t("update.check")}</button><button id="about-done" value="cancel" class="primary-button">完成</button></footer>
  </form></dialog>
  <dialog id="license-dialog" class="modal license-modal"><form method="dialog">
    <header><div><small>软件许可证</small><h2>GNU GPL 第 3 版或后续版本</h2></div><button value="cancel" class="dialog-close">×</button></header>
    <div class="license-body"><div class="license-context"><code>GPL-3.0-or-later</code><p class="license-summary">使用、研究、修改与再分发，遵循 GPL 条款；本软件不提供担保。</p><p class="license-scope">此许可证适用于 eRAW 软件。第三方组件保留各自的许可证。</p><p class="license-original">以下为随程序提供的英文许可证原文。</p></div><pre id="license-text" tabindex="0"></pre></div>
    <footer><button id="back-from-license" type="button" class="secondary-button">返回关于</button><button value="cancel" class="primary-button">完成</button></footer>
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
        <div><strong>Apache ECharts</strong><span>交互式统计图表</span><code>Apache-2.0</code></div>
        <div><strong>KaTeX</strong><span>LaTeX 解析与 MathML 公式排版</span><code>MIT</code></div>
        <div><strong>Tauri Opener Plugin</strong><span>在系统浏览器打开仓库</span><code>MIT OR Apache-2.0</code></div>
      </div>
      <p class="open-source-note">完整依赖清单见源代码中的 THIRD_PARTY_NOTICES.md；各组件的完整许可文本见其上游源码。</p>
    </div>
    <footer><button id="back-to-about" type="button" class="secondary-button">返回关于</button><button value="cancel" class="primary-button">完成</button></footer>
  </form></dialog>`;
}

export function renderUpdateCheck(root: ParentNode, state: UpdateCheckStatus): void {
  const get = <T extends HTMLElement = HTMLElement>(id: string): T => {
    const element = root.querySelector<T>(`#${id}`);
    if (!element) throw new Error(t("error.elementMissing", { id }));
    return element;
  };
  const checking = state.status === "checking";
  const button = get<HTMLButtonElement>("check-updates");
  button.disabled = checking;
  button.textContent = t(checking ? "update.checking" : "update.check");
  get("update-check-result").hidden = state.status === "idle";
  const message = updateCheckMessage(state);
  get("update-check-message").textContent = t(message.key, message.values);
  const download = get<HTMLAnchorElement>("update-download");
  const release = get<HTMLAnchorElement>("update-release");
  download.hidden = state.status !== "available" || !state.downloadAvailable || !state.downloadUrl;
  if (state.status === "available" && state.downloadAvailable && state.downloadUrl) download.href = state.downloadUrl;
  else download.removeAttribute("href");
  release.hidden = state.status !== "available" && state.status !== "failed";
  release.href = state.status === "available" ? state.releaseUrl : LATEST_RELEASE_URL;
}
