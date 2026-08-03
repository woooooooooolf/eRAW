import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [
  packageSource,
  configSource,
  zhHtmlSource,
  enHtmlSource,
  zhScriptSource,
  enScriptSource,
  runtimeSource,
  styleSource,
  gitignoreSource,
  readmeSource,
] = await Promise.all([
  read("package.json"),
  read("vite.pages.config.ts"),
  read("site/index.html"),
  read("site/en/index.html"),
  read("site/main.ts"),
  read("site/en/main.ts"),
  read("site/site-runtime.ts"),
  read("site/styles.css"),
  read(".gitignore"),
  read("site/README.md"),
]);

const packageJson = JSON.parse(packageSource);

test("the bilingual project site builds independently of the application version", () => {
  assert.equal(packageJson.scripts["dev:site"], "vite --config vite.pages.config.ts");
  assert.match(packageJson.scripts["build:site"], /site\/tsconfig\.json/);
  assert.match(configSource, /root: "site"/);
  assert.match(configSource, /base: "\/eRAW\/"/);
  assert.match(configSource, /host: "127\.0\.0\.1"/);
  assert.match(configSource, /port: 4174/);
  assert.match(configSource, /strictPort: true/);
  assert.match(configSource, /outDir: "\.\.\/dist-site"/);
  assert.match(configSource, /site\/index\.html/);
  assert.match(configSource, /site\/en\/index\.html/);
  assert.doesNotMatch(configSource, /packageJson|readFileSync|__ERAW_VERSION__/);
  assert.doesNotMatch(`${zhHtmlSource}\n${enHtmlSource}\n${runtimeSource}`, /0\.5\.5|__ERAW_VERSION__|data-site-version/);
  assert.match(gitignoreSource, /^dist-site\/$/m);
  assert.match(readmeSource, /站点不显示或读取 eRAW 软件版本/);
});

test("the Chinese page follows the agreed reading order and links to English", () => {
  assert.match(zhHtmlSource, /<html lang="zh-CN"/);
  const orderedPhrases = [
    "页面语言",
    "打开 RAW，看看里面",
    "data-screenshot-dark",
    "data-screenshot-light",
    "<p>基于 Tauri 的极简轻量化 RAW 图像查看器",
    "下载 Windows x64 EXE",
    "page-divider",
    "project-info",
    "site-footer",
  ];
  let previous = -1;
  for (const phrase of orderedPhrases) {
    const current = zhHtmlSource.indexOf(phrase);
    assert.ok(current > previous, `${phrase} should follow the previous Chinese page section`);
    previous = current;
  }
  assert.match(zhHtmlSource, /href="\.\/en\/" lang="en"/);
  assert.match(zhHtmlSource, /支持简体中文、繁體中文、English、日本語、Español、Français、Deutsch。/);
  assert.match(zhHtmlSource, /本地处理，无遥测/);
  assert.doesNotMatch(zhHtmlSource, /一个随手可用的 RAW 工具|<p class="section-label">关于/);
});

test("the English page mirrors the Chinese structure and links back", () => {
  assert.match(enHtmlSource, /<html lang="en"/);
  const orderedPhrases = [
    "Page language",
    "Open RAW. See what's inside.",
    "data-screenshot-dark",
    "data-screenshot-light",
    "A minimal, lightweight RAW image viewer built with Tauri",
    "Download Windows x64 EXE",
    "page-divider",
    "project-info",
    "site-footer",
  ];
  let previous = -1;
  for (const phrase of orderedPhrases) {
    const current = enHtmlSource.indexOf(phrase);
    assert.ok(current > previous, `${phrase} should follow the previous English page section`);
    previous = current;
  }
  assert.match(enHtmlSource, /href="\.\.\/" lang="zh-CN"/);
  assert.match(enHtmlSource, /Available in English, 简体中文, 繁體中文, 日本語, Español, Français, and Deutsch\./);
  assert.match(enHtmlSource, /Local processing, no telemetry/);
  assert.doesNotMatch(enHtmlSource, /<h2[^>]*>About/);
});

test("both locales use replaceable theme captures and a release-resolved x64 download", async () => {
  const [darkZh, lightZh, darkEn, lightEn] = await Promise.all([
    stat(new URL("../site/screenshots/app-main-dark-zh-CN.png", import.meta.url)),
    stat(new URL("../site/screenshots/app-main-light-zh-CN.png", import.meta.url)),
    stat(new URL("../site/screenshots/app-main-dark-en.png", import.meta.url)),
    stat(new URL("../site/screenshots/app-main-light-en.png", import.meta.url)),
  ]);
  assert.ok(darkZh.size > 100_000);
  assert.ok(lightZh.size > 100_000);
  assert.equal(darkEn.size, darkZh.size);
  assert.equal(lightEn.size, lightZh.size);
  assert.match(zhScriptSource, /app-main-dark-zh-CN\.png/);
  assert.match(zhScriptSource, /app-main-light-zh-CN\.png/);
  assert.match(enScriptSource, /app-main-dark-en\.png/);
  assert.match(enScriptSource, /app-main-light-en\.png/);
  assert.match(runtimeSource, /api\.github\.com\/repos\/woooooooooolf\/eRAW\/releases\/latest/);
  assert.match(runtimeSource, /windows-x64\\\.exe/);
  assert.match(runtimeSource, /LATEST_RELEASE_URL/);
  assert.match(styleSource, /perspective: 1800px/);
  assert.match(styleSource, /shot-reflection/);
  assert.match(styleSource, /\.intro \{ max-width: 720px; margin: 48px auto 0; \}/);
  assert.match(styleSource, /color-scheme: light/);
  assert.match(styleSource, /width: min\(1344px/);
  assert.match(styleSource, /@media \(max-width: 980px\)/);
  assert.match(styleSource, /@media \(max-width: 620px\)/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(`${zhHtmlSource}\n${enHtmlSource}`, /google-analytics|googletagmanager|fonts\.googleapis|use\.typekit/i);
});
