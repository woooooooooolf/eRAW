import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { HELP_SECTIONS } from "./help-content";
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
    root.innerHTML = this.template();
    this.bindNavigation();
    if (isTauri()) void this.initialize();
  }

  private template(): string {
    const navigation = HELP_SECTIONS.map((section, index) => `
      <a href="#${section.id}" data-help-section="${section.id}"><b>${String(index + 1).padStart(2, "0")}</b><span>${section.title}</span></a>`).join("");
    const sections = HELP_SECTIONS.map((section, index) => `
      <section id="${section.id}" class="help-section" data-help-section-content="${section.id}">
        <header><span>${String(index + 1).padStart(2, "0")}</span><div><small>${section.kicker}</small><h2>${section.title}</h2><p>${section.summary}</p></div></header>
        <div class="help-section-body">${section.body}</div>
      </section>`).join("");
    return `<main class="help-window">
      <aside class="help-sidebar">
        <header><div class="help-mark">?</div><div><small>eRAW</small><strong data-i18n="helpWindow.title">使用手册</strong></div></header>
        <nav aria-label="使用手册目录"><small data-i18n="helpWindow.contents">目录</small>${navigation}</nav>
        <footer><button type="button" data-help-top><span>↑</span><span data-i18n="helpWindow.backToTop">返回顶部</span></button></footer>
      </aside>
      <article class="help-document">
        <header class="help-hero"><div><small>eRAW USER MANUAL</small><h1 data-i18n="helpWindow.title">使用手册</h1><p>面向传感器 RAW 查看、诊断与确定性格式转换的使用参考。</p></div><span>V0.4</span></header>
        <aside class="help-language-notice" hidden><strong>i</strong><p data-i18n="helpWindow.chineseReview">当前为审核中的中文手册，其它语言版本将在确认后提供。</p></aside>
        ${sections}
      </article>
    </main>`;
  }

  private bindNavigation(): void {
    this.root.querySelector<HTMLButtonElement>("[data-help-top]")?.addEventListener("click", () => {
      this.root.querySelector<HTMLElement>(".help-document")?.scrollTo({ top: 0, behavior: "smooth" });
    });
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (visible) this.setActiveSection(visible.target.id);
    }, { root: this.root.querySelector(".help-document"), rootMargin: "-18% 0px -66%", threshold: [0, 0.2, 0.6] });
    this.root.querySelectorAll<HTMLElement>("[data-help-section-content]").forEach((section) => observer.observe(section));
    this.setActiveSection(this.activeSection);
  }

  private setActiveSection(id: string): void {
    this.activeSection = id;
    this.root.querySelectorAll<HTMLElement>("[data-help-section]").forEach((link) => {
      link.classList.toggle("active", link.dataset.helpSection === id);
    });
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
