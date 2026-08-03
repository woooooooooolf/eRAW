import mainScreenshotUrl from "../docs/images/readme-main-zh-CN.jpg";
import erawIconUrl from "../src/assets/eraw-icon.svg";

const menuButton = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
const navigation = document.querySelector<HTMLElement>("[data-site-navigation]");
const themeButton = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
const root = document.documentElement;
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

document.querySelectorAll<HTMLImageElement>("[data-eraw-icon]").forEach((image) => {
  image.src = erawIconUrl;
});

const mainScreenshot = document.querySelector<HTMLImageElement>("[data-main-screenshot]");
if (mainScreenshot) mainScreenshot.src = mainScreenshotUrl;

const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (favicon) favicon.href = erawIconUrl;

document.querySelectorAll<HTMLElement>("[data-site-version]").forEach((element) => {
  element.textContent = `V${__ERAW_VERSION__}`;
});

document.querySelectorAll<HTMLElement>("[data-current-year]").forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

const storedTheme = localStorage.getItem("eraw.site.theme");
if (storedTheme === "light" || storedTheme === "dark") root.dataset.theme = storedTheme;

function updateThemeLabel(): void {
  const isLight = root.dataset.theme === "light";
  themeColor?.setAttribute("content", isLight ? "#edf3f7" : "#070a0f");
  if (themeButton) {
    themeButton.setAttribute("aria-label", isLight ? "切换到深色外观" : "切换到浅色外观");
    themeButton.setAttribute("title", isLight ? "切换到深色外观" : "切换到浅色外观");
  }
}

updateThemeLabel();

themeButton?.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = nextTheme;
  localStorage.setItem("eraw.site.theme", nextTheme);
  updateThemeLabel();
});

menuButton?.addEventListener("click", () => {
  if (!navigation) return;
  const expanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!expanded));
  menuButton.setAttribute("aria-label", expanded ? "打开导航" : "关闭导航");
  navigation.dataset.open = String(!expanded);
});

navigation?.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLAnchorElement) || !menuButton) return;
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "打开导航");
  navigation.dataset.open = "false";
});
