import "./styles.css";
import { ErawApp } from "./app";
import { t } from "./i18n";
import { StatisticsWindowApp } from "./statistics-window";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error(t("error.rootMissing"));
const appRoot = root;

function showFatalError(error: unknown): void {
  appRoot.innerHTML = `<main class="fatal-error"><h1>${t("runtime.fatalTitle")}</h1><p>${String(error)}</p><small>${t("runtime.fatalHint")}</small></main>`;
}

try {
  const page = new URLSearchParams(window.location.search);
  if (page.get("help") === "1") {
    void import("./help-window")
      .then(({ HelpWindowApp }) => new HelpWindowApp(appRoot))
      .catch(showFatalError);
  } else if (page.get("statistics") === "1") {
    new StatisticsWindowApp(appRoot);
  } else {
    new ErawApp(appRoot);
  }
} catch (error) {
  showFatalError(error);
}
