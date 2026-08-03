import erawIconUrl from "../src/assets/eraw-icon.svg";

const LATEST_RELEASE_URL = "https://github.com/woooooooooolf/eRAW/releases/latest";
const LATEST_RELEASE_API = "https://api.github.com/repos/woooooooooolf/eRAW/releases/latest";

interface GitHubReleaseAsset {
  name?: unknown;
  browser_download_url?: unknown;
}

interface GitHubRelease {
  assets?: GitHubReleaseAsset[];
}

export function configureSite(screenshots: {
  darkScreenshotUrl: string;
  lightScreenshotUrl: string;
}): void {
  document.querySelectorAll<HTMLImageElement>("[data-eraw-icon]").forEach((image) => {
    image.src = erawIconUrl;
  });

  document.querySelectorAll<HTMLImageElement>("[data-screenshot-dark]").forEach((image) => {
    image.src = screenshots.darkScreenshotUrl;
  });

  document.querySelectorAll<HTMLImageElement>("[data-screenshot-light]").forEach((image) => {
    image.src = screenshots.lightScreenshotUrl;
  });

  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = erawIconUrl;

  document.querySelectorAll<HTMLElement>("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  void resolveWindowsDownload();
}

async function resolveWindowsDownload(): Promise<void> {
  let downloadUrl = LATEST_RELEASE_URL;
  try {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (response.ok) {
      const release = await response.json() as GitHubRelease;
      const asset = release.assets?.find((candidate) => (
        typeof candidate.name === "string"
        && /windows-x64\.exe$/i.test(candidate.name)
        && typeof candidate.browser_download_url === "string"
      ));
      if (asset && typeof asset.browser_download_url === "string") {
        downloadUrl = asset.browser_download_url;
      }
    }
  } catch {
    // 私有仓库、离线环境或 API 限流时保留 Latest Release 页面作为可用回退。
  }

  document.querySelectorAll<HTMLAnchorElement>("[data-download-exe]").forEach((link) => {
    link.href = downloadUrl;
  });
}
