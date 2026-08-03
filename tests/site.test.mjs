import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("the first site iteration is a Chinese project showcase with stable destinations", () => {
  assert.match(htmlSource, /<html lang="zh-CN"/);
  for (const id of ["capabilities", "workflow", "technology", "boundaries"]) {
    assert.match(htmlSource, new RegExp(`id="${id}"`));
  }
  assert.match(htmlSource, /看见传感器的/);
  assert.match(htmlSource, /Remosaic/);
  assert.match(htmlSource, /Demosaic/);
  assert.match(htmlSource, /统计与图表/);
  assert.match(htmlSource, /github\.com\/woooooooooolf\/eRAW\/releases\/latest/);
  assert.match(htmlSource, /data-main-screenshot/);
  assert.doesNotMatch(htmlSource, /0\.5\.5/);
  assert.doesNotMatch(htmlSource, /google-analytics|googletagmanager|fonts\.googleapis|use\.typekit/i);
});

test("site behavior and styles preserve theme, navigation, and responsive boundaries", () => {
  assert.match(scriptSource, /__ERAW_VERSION__/);
  assert.match(scriptSource, /eraw\.site\.theme/);
  assert.match(scriptSource, /aria-expanded/);
  assert.match(scriptSource, /关闭导航/);
  assert.match(scriptSource, /data-main-screenshot/);
  assert.match(styleSource, /font-family: Inter, ui-sans-serif, system-ui/);
  assert.match(styleSource, /@media \(max-width: 820px\)/);
  assert.match(styleSource, /@media \(max-width: 520px\)/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);
});
