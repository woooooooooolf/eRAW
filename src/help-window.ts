import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { HELP_GROUPS, HELP_SECTIONS } from "./help-content";
import { renderHelpMath } from "./help-math";
import {
  getResolvedLocale,
  refreshLocalizedTree,
  setLanguagePreference,
  t,
  type LanguagePreference,
} from "./i18n";
import type { AppTheme } from "./theme-catalog";

interface HelpWindowPayload {
  language: LanguagePreference;
  theme: AppTheme;
}

export class HelpWindowApp {
  private activeSection = HELP_SECTIONS[0]?.id ?? "";

  constructor(private readonly root: HTMLElement) {
    root.addEventListener("contextmenu", (event) => event.preventDefault());
    root.innerHTML = this.template();
    renderHelpMath(root);
    this.bindNavigation();
    if (isTauri()) void this.initialize();
  }

  private template(): string {
    const navigation = HELP_GROUPS.map((group) => {
      const links = HELP_SECTIONS.map((section, index) => ({ section, index }))
        .filter(({ section }) => section.group === group.id)
        .map(({ section, index }) => `
          <a href="#${section.id}" data-help-section="${section.id}"><b>${String(index + 1).padStart(2, "0")}</b><span>${section.title}</span></a>`)
        .join("");
      return `<section class="help-nav-group"><small>${group.title}</small>${links}</section>`;
    }).join("");
    const sections = HELP_SECTIONS.map((section, index) => `
      <section id="${section.id}" class="help-section help-page" data-help-section-content="${section.id}"${index === 0 ? "" : " hidden"}>
        <header class="help-page-header">
          <div class="help-page-index">${String(index + 1).padStart(2, "0")}</div>
          <div><small>${section.kicker}</small><h1>${section.title}</h1><p>${section.summary}</p>
            <div class="help-page-meta"><span>${section.level}</span><span>${section.readingTime}</span><span>第 ${index + 1} / ${HELP_SECTIONS.length} 篇</span></div>
          </div>
        </header>
        <div class="help-section-body">${section.body}</div>
        <footer class="help-page-footer">
          <button type="button" data-help-previous${index === 0 ? " disabled" : ""}><small>上一篇</small><strong>${index > 0 ? HELP_SECTIONS[index - 1].title : "已经是第一篇"}</strong></button>
          <button type="button" data-help-next${index === HELP_SECTIONS.length - 1 ? " disabled" : ""}><small>下一篇</small><strong>${index < HELP_SECTIONS.length - 1 ? HELP_SECTIONS[index + 1].title : "已经是最后一篇"}</strong></button>
        </footer>
      </section>`).join("");
    return `<main class="help-window">
      <aside class="help-sidebar">
        <header><div class="help-mark">Σ</div><div><small>eRAW V0.5.3</small><strong data-i18n="helpWindow.title">使用手册</strong><span>技术参考 · 中文</span></div></header>
        <nav aria-label="使用手册目录">${navigation}</nav>
        <footer><button type="button" data-help-home><span>⌂</span><span>手册首页</span></button></footer>
      </aside>
      <article class="help-document">
        <aside class="help-language-notice" hidden><strong>i</strong><p data-i18n="helpWindow.chineseReview">当前为审核中的中文手册，其它语言版本将在确认后提供。</p></aside>
        ${sections}
      </article>
    </main>`;
  }

  private bindNavigation(): void {
    const requested = decodeURIComponent(window.location.hash.slice(1));
    if (HELP_SECTIONS.some((section) => section.id === requested)) this.activeSection = requested;
    this.root.querySelectorAll<HTMLAnchorElement>("[data-help-section]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        this.setActiveSection(link.dataset.helpSection ?? "", true);
      });
    });
    this.root.querySelector<HTMLButtonElement>("[data-help-home]")?.addEventListener("click", () => {
      this.setActiveSection(HELP_SECTIONS[0]?.id ?? "", true);
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-help-previous]").forEach((button) => {
      button.addEventListener("click", () => this.movePage(-1));
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-help-next]").forEach((button) => {
      button.addEventListener("click", () => this.movePage(1));
    });
    window.addEventListener("hashchange", () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (HELP_SECTIONS.some((section) => section.id === id)) this.setActiveSection(id, false);
    });
    this.setActiveSection(this.activeSection);
  }

  private movePage(offset: -1 | 1): void {
    const index = HELP_SECTIONS.findIndex((section) => section.id === this.activeSection);
    const target = HELP_SECTIONS[index + offset];
    if (target) this.setActiveSection(target.id, true);
  }

  private setActiveSection(id: string, updateHash = false): void {
    if (!HELP_SECTIONS.some((section) => section.id === id)) return;
    this.activeSection = id;
    this.root.querySelectorAll<HTMLElement>("[data-help-section]").forEach((link) => {
      const active = link.dataset.helpSection === id;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    this.root.querySelectorAll<HTMLElement>("[data-help-section-content]").forEach((section) => {
      section.hidden = section.dataset.helpSectionContent !== id;
    });
    this.root.querySelector<HTMLElement>(".help-document")?.scrollTo({ top: 0 });
    this.root.querySelector<HTMLElement>(`[data-help-section="${id}"]`)?.scrollIntoView({ block: "nearest" });
    if (updateHash && window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
  }

  private async initialize(): Promise<void> {
    await listen<HelpWindowPayload>("help:state", (event) => this.setState(event.payload));
    await emit("help:ready");
  }

  private setState(payload: HelpWindowPayload): void {
    setLanguagePreference(payload.language);
    document.documentElement.dataset.theme = payload.theme;
    document.title = `eRAW - ${t("helpWindow.title")}`;
    this.root.querySelector<HTMLElement>(".help-language-notice")!.hidden = getResolvedLocale() === "zh-CN";
    refreshLocalizedTree(this.root);
  }
}
