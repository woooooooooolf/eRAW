import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  setLanguagePreference,
  t,
  type LanguagePreference,
} from "./i18n";
import {
  StatisticsPanel,
  type StatisticsPanelAction,
  type StatisticsPanelState,
  type StatisticsWindowActionMessage,
} from "./statistics-panel";
import type { AppTheme } from "./theme-catalog";

interface StatisticsWindowPayload {
  state: StatisticsPanelState;
  language: LanguagePreference;
  theme: AppTheme;
}

export class StatisticsWindowApp {
  private readonly panel: StatisticsPanel;
  private readonly appWindow = getCurrentWindow();

  constructor(root: HTMLElement) {
    root.innerHTML = '<main id="statistics-window-panel" class="statistics-panel statistics-window-panel detached"></main>';
    this.panel = new StatisticsPanel(
      root.querySelector<HTMLElement>("#statistics-window-panel")!,
      {
        detached: true,
        onAction: (action) => void this.handleAction(action),
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          void emit("statistics:window-error", message);
        },
        onNotify: (message) => void emit("statistics:notify", message),
      },
    );
    if (isTauri()) void this.initialize();
  }

  private async initialize(): Promise<void> {
    await listen<StatisticsWindowPayload>("statistics:state", (event) => {
      setLanguagePreference(event.payload.language);
      document.documentElement.dataset.theme = event.payload.theme;
      this.panel.setState(event.payload.state);
      document.title = event.payload.state.documentName
        ? `${event.payload.state.documentName} — ${t("statistics.title")}`
        : t("statistics.title");
    });
    await this.appWindow.onCloseRequested((event) => {
      event.preventDefault();
      void this.handleAction("close");
    });
    await emit("statistics:ready");
  }

  private emitAction(action: StatisticsPanelAction): Promise<void> {
    const message: StatisticsWindowActionMessage = { action, source: "detached" };
    return emit("statistics:action", message);
  }

  private async handleAction(action: StatisticsPanelAction): Promise<void> {
    try {
      await this.emitAction(action);
      if (action === "close" || action === "dock") {
        await this.appWindow.destroy();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await emit("statistics:window-error", message);
    }
  }
}
