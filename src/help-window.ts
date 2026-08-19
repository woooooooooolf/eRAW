import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getHelpCatalog, type HelpCatalog } from "./help-content-localized";
import { renderHelpMath } from "./help-math";
import {
  getResolvedLocale,
  setLanguagePreference,
  t,
  type LanguagePreference,
} from "./i18n";
import type { AppTheme } from "./theme-catalog";

interface HelpWindowPayload {
  language: LanguagePreference;
  theme: AppTheme;
}

function queryLanguagePreference(value: string | null): LanguagePreference | null {
  switch (value) {
    case "system": return "system";
    case "en": return "en";
    case "zh-CN": return "zh-CN";
    case "zh-TW": return "zh-TW";
    case "ja": return "ja";
    case "es": return "es";
    case "fr": return "fr";
    case "de": return "de";
    default: return null;
  }
}

export class HelpWindowApp {
  private catalog: HelpCatalog;
  private activeSection = "";

  constructor(private readonly root: HTMLElement) {
    const requestedLanguage = queryLanguagePreference(new URLSearchParams(window.location.search).get("lang"));
    if (requestedLanguage) setLanguagePreference(requestedLanguage);
    this.catalog = getHelpCatalog(getResolvedLocale());
    this.activeSection = this.catalog.sections[0]?.id ?? "";
    root.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("hashchange", () => this.syncHash());
    this.render();
    if (isTauri()) void this.initialize();
  }

  private template(): string {
    const { groups, sections: helpSections, ui } = this.catalog;
    const navigation = groups.map((group) => {
      const links = helpSections.map((section, index) => ({ section, index }))
        .filter(({ section }) => section.group === group.id)
        .map(({ section, index }) => `
          <a href="#${section.id}" data-help-section="${section.id}"><b>${String(index + 1).padStart(2, "0")}</b><span>${section.title}</span></a>`)
        .join("");
      return `<section class="help-nav-group"><small>${group.title}</small>${links}</section>`;
    }).join("");
    const sections = helpSections.map((section, index) => `
      <section id="${section.id}" class="help-section help-page" data-help-section-content="${section.id}"${index === 0 ? "" : " hidden"}>
        <header class="help-page-header">
          <div class="help-page-index">${String(index + 1).padStart(2, "0")}</div>
          <div><small>${section.kicker}</small><h1>${section.title}</h1><p>${section.summary}</p>
            <div class="help-page-meta"><span>${section.level}</span><span>${section.readingTime}</span><span>${this.formatUi(ui.article, index + 1, helpSections.length)}</span></div>
          </div>
        </header>
        <div class="help-section-body">${section.body}</div>
        <footer class="help-page-footer">
          <button type="button" data-help-previous${index === 0 ? " disabled" : ""}><small>${ui.previous}</small><strong>${index > 0 ? helpSections[index - 1].title : ui.first}</strong></button>
          <button type="button" data-help-next${index === helpSections.length - 1 ? " disabled" : ""}><small>${ui.next}</small><strong>${index < helpSections.length - 1 ? helpSections[index + 1].title : ui.last}</strong></button>
        </footer>
      </section>`).join("");
    return `<main class="help-window" data-help-locale="${getResolvedLocale()}">
      <aside class="help-sidebar">
        <header><div class="help-mark">Σ</div><div><small>eRAW V0.5.5</small><strong>${ui.manualTitle}</strong><span>${ui.subtitle}</span></div></header>
        <nav aria-label="${ui.navigationLabel}">${navigation}</nav>
        <footer><button type="button" data-help-home><span>⌂</span><span>${ui.home}</span></button></footer>
      </aside>
      <article class="help-document">
        ${sections}
      </article>
    </main>`;
  }

  private formatUi(template: string, current: number, total: number): string {
    return template.replace("{current}", String(current)).replace("{total}", String(total));
  }

  private render(): void {
    this.root.innerHTML = this.template();
    renderHelpMath(this.root);
    this.bindNavigation();
    this.syncHash();
  }

  private bindNavigation(): void {
    this.root.querySelectorAll<HTMLAnchorElement>("[data-help-section]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        this.setActiveSection(link.dataset.helpSection ?? "", true);
      });
    });
    this.root.querySelector<HTMLButtonElement>("[data-help-home]")?.addEventListener("click", () => {
      this.setActiveSection(this.catalog.sections[0]?.id ?? "", true);
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-help-previous]").forEach((button) => {
      button.addEventListener("click", () => this.movePage(-1));
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-help-next]").forEach((button) => {
      button.addEventListener("click", () => this.movePage(1));
    });
    this.setActiveSection(this.activeSection);
  }

  private syncHash(): void {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (this.catalog.sections.some((section) => section.id === id)) this.activeSection = id;
    this.setActiveSection(this.activeSection);
  }

  private movePage(offset: -1 | 1): void {
    const index = this.catalog.sections.findIndex((section) => section.id === this.activeSection);
    const target = this.catalog.sections[index + offset];
    if (target) this.setActiveSection(target.id, true);
  }

  private setActiveSection(id: string, updateHash = false): void {
    if (!this.catalog.sections.some((section) => section.id === id)) return;
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
    const previousLocale = getResolvedLocale();
    setLanguagePreference(payload.language);
    document.documentElement.dataset.theme = payload.theme;
    document.title = `eRAW - ${t("helpWindow.title")}`;
    if (getResolvedLocale() !== previousLocale) {
      this.catalog = getHelpCatalog(getResolvedLocale());
      this.render();
    }
  }
}
