import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(await readFile(new URL("../src/preference-storage.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { readPreferenceFields, savePreferenceChanges } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

function storage(entries = []) {
  const values = new Map(entries);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const defaults = { theme: "dark", language: "en", width: 320 };

test("stale windows save independent fields without replacing another window's change", () => {
  const shared = storage([["settings", JSON.stringify(defaults)]]);
  const a = readPreferenceFields(shared, "settings", defaults);
  const b = readPreferenceFields(shared, "settings", defaults);
  savePreferenceChanges(shared, "settings", a, { ...a, theme: "light" });
  savePreferenceChanges(shared, "settings", b, { ...b, width: 440 });
  assert.deepEqual(readPreferenceFields(shared, "settings", defaults), { ...defaults, theme: "light", width: 440 });
  assert.equal(a.theme, "dark"); // An open document is not changed by shared defaults.
});

test("the same field uses the last save and initialization does not write", () => {
  const shared = storage();
  savePreferenceChanges(shared, "settings", defaults, defaults);
  assert.deepEqual(readPreferenceFields(shared, "settings", defaults), {});
  savePreferenceChanges(shared, "settings", defaults, { ...defaults, theme: "light" });
  savePreferenceChanges(shared, "settings", defaults, { ...defaults, theme: "violet" });
  assert.equal(readPreferenceFields(shared, "settings", defaults).theme, "violet");
});

test("legacy values survive migration and malformed fields are isolated", () => {
  const shared = storage([
    ["settings", JSON.stringify(defaults)],
    ["settings.theme", '"light"'],
    ["settings.width", "bad-json"],
  ]);
  assert.deepEqual(readPreferenceFields(shared, "settings", defaults), { ...defaults, theme: "light" });
  shared.setItem("settings", "[]");
  assert.deepEqual(readPreferenceFields(shared, "settings", defaults), { theme: "light" });
});
