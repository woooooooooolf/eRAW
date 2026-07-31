import "./styles.css";
import { ErawApp } from "./app";
import { t } from "./i18n";
import { StatisticsWindowApp } from "./statistics-window";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error(t("error.rootMissing"));

try {
  if (new URLSearchParams(window.location.search).get("statistics") === "1") {
    new StatisticsWindowApp(root);
  } else {
    new ErawApp(root);
  }
} catch (error) {
  root.innerHTML = `<main class="fatal-error"><h1>${t("runtime.fatalTitle")}</h1><p>${String(error)}</p><small>${t("runtime.fatalHint")}</small></main>`;
}
