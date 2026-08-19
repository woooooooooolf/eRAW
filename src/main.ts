import "./styles.css";
import { ErawApp } from "./app";
import { t } from "./i18n";
import { StatisticsWindowApp } from "./statistics-window";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error(t("error.rootMissing"));
const appRoot = root;

function showFatalError(error: unknown): void {
  const fatal = document.createElement("main");
  fatal.className = "fatal-error";
  const title = document.createElement("h1");
  title.textContent = t("runtime.fatalTitle");
  const detail = document.createElement("p");
  detail.textContent = String(error);
  const hint = document.createElement("small");
  hint.textContent = t("runtime.fatalHint");
  fatal.append(title, detail, hint);
  appRoot.replaceChildren(fatal);
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
