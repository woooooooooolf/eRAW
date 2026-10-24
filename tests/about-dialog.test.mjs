import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [appSource, styleSource, i18nSource, packageSource, apiSource, commandsSource, backendSource] = await Promise.all([
  readFile(new URL("src/app.ts", root), "utf8"),
  readFile(new URL("src/styles.css", root), "utf8"),
  readFile(new URL("src/i18n.ts", root), "utf8"),
  readFile(new URL("package.json", root), "utf8"),
  readFile(new URL("src/api.ts", root), "utf8"),
  readFile(new URL("src-tauri/src/commands.rs", root), "utf8"),
  readFile(new URL("src-tauri/src/lib.rs", root), "utf8"),
]);

test("About presents minimal branding and a localized repository link", () => {
  assert.doesNotMatch(appSource, /RAW SENSOR LAB|RAW 传感器实验室/);
  assert.doesNotMatch(i18nSource, /"about\.lab"/);
  assert.match(appSource, /<h2 class="about-product-name">eRAW<\/h2>/);
  assert.match(styleSource, /\.about-product-name\s*\{[^}]*linear-gradient\([^}]*background-clip:\s*text/s);
  assert.match(appSource, /id="about-repository"[^>]*href="https:\/\/github\.com\/woooooooooolf\/eRAW"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(appSource, /text\("#about-repository strong", "about\.repository"\)/);
  assert.match(appSource, /Codex \(GPT-5\.6 Sol\/GPT-6\.1 Sol\)/);
  assert.doesNotMatch(appSource + i18nSource, /repositoryAvailability|以仓库实际公开情况为准/);
  assert.match(apiSource, /invoke\("open_project_repository"\)/);
  assert.match(commandsSource, /pub fn open_project_repository\(app: tauri::AppHandle\)/);
  assert.match(commandsSource, /open_url\(env!\("CARGO_PKG_REPOSITORY"\), None::<&str>\)/);
  assert.match(backendSource, /open_js_links_on_click\(false\)/);
  assert.doesNotMatch(packageSource, /plugin-opener/);
});
