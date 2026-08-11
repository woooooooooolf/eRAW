import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [appSource, styleSource, i18nSource, packageSource] = await Promise.all([
  readFile(new URL("src/app.ts", root), "utf8"),
  readFile(new URL("src/styles.css", root), "utf8"),
  readFile(new URL("src/i18n.ts", root), "utf8"),
  readFile(new URL("package.json", root), "utf8"),
]);

test("About presents minimal branding and a localized repository link", () => {
  assert.doesNotMatch(appSource, /RAW SENSOR LAB|RAW 传感器实验室/);
  assert.doesNotMatch(i18nSource, /"about\.lab"/);
  assert.match(appSource, /<h2 class="about-product-name">eRAW<\/h2>/);
  assert.match(styleSource, /\.about-product-name\s*\{[^}]*linear-gradient\([^}]*background-clip:\s*text/s);
  assert.match(appSource, /id="about-repository"[^>]*href="https:\/\/github\.com\/woooooooooolf\/eRAW"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(appSource, /text\("#about-repository strong", "about\.repository"\)/);
  assert.match(appSource, /text\("#about-repository small", "about\.repositoryAvailability"\)/);
  assert.match(i18nSource, /"about\.repositoryAvailability": message\([^\n]*以仓库实际公开情况为准/);
  assert.doesNotMatch(packageSource, /plugin-opener/);
});
