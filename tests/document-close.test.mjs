import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [apiSource, appSource, viewportSource, styleSource] = await Promise.all([
  readFile(new URL("../src/api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
]);

test("the frontend exposes and invokes the backend close command", () => {
  assert.match(
    apiSource,
    /export function closeDocument\(\): Promise<void> \{\s*return invoke\("close_document"\);\s*\}/,
  );
  assert.match(appSource, /event\.key\.toLowerCase\(\) === "w" && this\.document/);
  assert.match(appSource, /await closeDocument\(\)/);
});

test("closing a document clears viewport-owned resources", () => {
  const clearMethod = viewportSource.match(
    /clearDocument\(\): void \{(?<body>[\s\S]*?)\r?\n  \}\r?\n\r?\n  setFrame/,
  )?.groups?.body;
  assert.ok(clearMethod);
  assert.match(clearMethod, /this\.document = null/);
  assert.match(clearMethod, /this\.overlayLayer\.clearSelection\(\)/);
  assert.match(clearMethod, /this\.clearTextures\(\)/);
  assert.match(clearMethod, /this\.callbacks\.onRenderStats\("L0", 0, 0/);
});

test("all six themes define a close-file danger color", () => {
  assert.equal([...styleSource.matchAll(/--danger-rgb:/g)].length, 6);
  assert.match(styleSource, /\.tool-button\.close-file/);
  assert.match(styleSource, /\.tool-button\.close-file:hover:not\(:disabled\)/);
});
