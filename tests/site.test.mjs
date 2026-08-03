import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [packageSource, configSource, htmlSource, scriptSource, styleSource, gitignoreSource, readmeSource] = await Promise.all([
  read("package.json"),
  read("vite.pages.config.ts"),
  read("site/index.html"),
  read("site/main.ts"),
  read("site/styles.css"),
  read(".gitignore"),
  read("site/README.md"),
]);

const packageJson = JSON.parse(packageSource);

test("the project site builds independently without owning the application version", () => {
  assert.equal(packageJson.version, "0.5.5");
  assert.equal(packageJson.scripts["dev:site"], "vite --config vite.pages.config.ts");
  assert.match(packageJson.scripts["build:site"], /site\/tsconfig\.json/);
  assert.match(configSource, /root: "site"/);
  assert.match(configSource, /base: "\/eRAW\/"/);
  assert.match(configSource, /host: "127\.0\.0\.1"/);
  assert.match(configSource, /port: 4174/);
  assert.match(configSource, /strictPort: true/);
  assert.match(configSource, /outDir: "\.\.\/dist-site"/);
  assert.match(configSource, /packageJson\.version/);
  assert.match(gitignoreSource, /^dist-site\/$/m);
  assert.match(readmeSource, /站点迭代不修改 eRAW 软件版本/);
});

test("the Chinese site follows the agreed single-page reading order", () => {
  assert.match(htmlSource, /<html lang="zh-CN"/);
  const orderedPhrases = [
    "页面语言",
    "打开 RAW，看看里面",
    "data-screenshot-dark",
    "data-screenshot-light",
    "<p>基于 Tauri 的极简轻量化 RAW 图像查看器",
    "data-download-exe",
    "page-divider",
    "project-info",
    "site-footer",
  ];
  let previous = -1;
  for (const phrase of orderedPhrases) {
    const current = htmlSource.indexOf(phrase);
    assert.ok(current > previous, `${phrase} should follow the previous page section`);
    previous = current;
  }
  assert.match(htmlSource, /中文/);
  assert.match(htmlSource, />EN</);
  assert.match(htmlSource, /github\.com\/woooooooooolf\/eRAW/);
  assert.match(htmlSource, /本地处理，无遥测/);
  assert.doesNotMatch(htmlSource, /一个随手可用的 RAW 工具|<p class="section-label">关于/);
  assert.doesNotMatch(htmlSource, /0\.5\.5/);
  assert.doesNotMatch(htmlSource, /google-analytics|googletagmanager|fonts\.googleapis|use\.typekit/i);
});

test("the showcase uses real theme captures and a version-aware EXE link", async () => {
  const [dark, light] = await Promise.all([
    stat(new URL("../site/screenshots/app-main-dark-zh-CN.png", import.meta.url)),
    stat(new URL("../site/screenshots/app-main-light-zh-CN.png", import.meta.url)),
  ]);
  assert.ok(dark.size > 100_000);
  assert.ok(light.size > 100_000);
  assert.match(scriptSource, /app-main-dark-zh-CN\.png/);
  assert.match(scriptSource, /app-main-light-zh-CN\.png/);
  assert.match(scriptSource, /releases\/latest\/download\/eRAW-V\$\{__ERAW_VERSION__\}-windows-x64\.exe/);
  assert.match(styleSource, /perspective: 1800px/);
  assert.match(styleSource, /shot-reflection/);
  assert.match(styleSource, /color-scheme: light/);
  assert.match(styleSource, /width: min\(1344px/);
  assert.match(styleSource, /@media \(max-width: 980px\)/);
  assert.match(styleSource, /@media \(max-width: 620px\)/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);
});
