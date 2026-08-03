import erawIconUrl from "../src/assets/eraw-icon.svg";
import darkScreenshotUrl from "./screenshots/app-main-dark-zh-CN.png";
import lightScreenshotUrl from "./screenshots/app-main-light-zh-CN.png";

document.querySelectorAll<HTMLImageElement>("[data-eraw-icon]").forEach((image) => {
  image.src = erawIconUrl;
});

document.querySelectorAll<HTMLImageElement>("[data-screenshot-dark]").forEach((image) => {
  image.src = darkScreenshotUrl;
});

document.querySelectorAll<HTMLImageElement>("[data-screenshot-light]").forEach((image) => {
  image.src = lightScreenshotUrl;
});

const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (favicon) favicon.href = erawIconUrl;

document.querySelectorAll<HTMLElement>("[data-site-version]").forEach((element) => {
  element.textContent = `V${__ERAW_VERSION__}`;
});

document.querySelectorAll<HTMLAnchorElement>("[data-download-exe]").forEach((link) => {
  link.href = `https://github.com/woooooooooolf/eRAW/releases/latest/download/eRAW-V${__ERAW_VERSION__}-windows-x64.exe`;
});

document.querySelectorAll<HTMLElement>("[data-current-year]").forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

document.querySelectorAll<HTMLAnchorElement>("[data-language-pending]").forEach((link) => {
  link.addEventListener("click", (event) => event.preventDefault());
});
