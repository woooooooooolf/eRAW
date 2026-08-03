import mainScreenshotUrl from "../docs/images/readme-main-zh-CN.jpg";
import erawIconUrl from "../src/assets/eraw-icon.svg";

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
