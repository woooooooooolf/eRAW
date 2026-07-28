import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the main window can enter native fullscreen", async () => {
  const source = await readFile(
    new URL("../src-tauri/capabilities/default.json", import.meta.url),
    "utf8",
  );
  const capability = JSON.parse(source);
  assert.ok(capability.permissions.includes("core:window:allow-set-fullscreen"));
});
