import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
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
} from "./statistics-panel";
import type { AppTheme } from "./theme-catalog";

interface StatisticsWindowPayload {
  state: StatisticsPanelState;
  language: LanguagePreference;
  theme: AppTheme;
}

export class StatisticsWindowApp {
  private readonly panel: StatisticsPanel;

  constructor(root: HTMLElement) {
    root.innerHTML = '<main id="statistics-window-panel" class="statistics-panel statistics-window-panel detached"></main>';
    this.panel = new StatisticsPanel(
      root.querySelector<HTMLElement>("#statistics-window-panel")!,
      {
        detached: true,
        onAction: (action) => void emitTo("main", "statistics:action", action),
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          void emitTo("main", "statistics:window-error", message);
        },
        onNotify: (message) => void emitTo("main", "statistics:notify", message),
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
    await getCurrentWindow().onCloseRequested(() => {
      void emitTo("main", "statistics:action", "close" satisfies StatisticsPanelAction);
    });
    await emitTo("main", "statistics:ready");
  }
}
