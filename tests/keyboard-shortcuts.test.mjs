import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const shortcutSource = await readFile(new URL("../src/keyboard-shortcuts.ts", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(shortcutSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const shortcuts = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

function shortcutEvent(key, modifiers = {}) {
  return {
    key,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...modifiers,
  };
}

test("shortcut matching is case-insensitive for letters and exact for every modifier", () => {
  assert.equal(shortcuts.matchesShortcut(shortcutEvent("I", { ctrlKey: true }), { key: "i", ctrl: true }), true);
  assert.equal(shortcuts.matchesShortcut(shortcutEvent("I", { ctrlKey: true, shiftKey: true }), { key: "i", ctrl: true }), false);
  assert.equal(shortcuts.matchesShortcut(shortcutEvent("o", { ctrlKey: true, altKey: true }), { key: "o", ctrl: true }), false);
  assert.equal(shortcuts.matchesShortcut(shortcutEvent("F11", { metaKey: true }), { key: "F11" }), false);
  assert.equal(shortcuts.matchesShortcut(shortcutEvent("]"), { key: "]" }), true);
});

test("primary display-mode sequences follow the CFA capabilities", () => {
  assert.deepEqual(shortcuts.primaryDisplayModes("MONO"), ["raw"]);
  assert.deepEqual(shortcuts.primaryDisplayModes("RGGB"), ["raw", "bayer", "demosaic"]);
  assert.deepEqual(shortcuts.primaryDisplayModes("QRGGB"), ["raw", "bayer", "remosaic", "demosaic"]);
});

test("primary display-mode cycling wraps and leaves detailed channel views unchanged", () => {
  assert.equal(shortcuts.cyclePrimaryDisplayMode("raw", "RGGB", 1), "bayer");
  assert.equal(shortcuts.cyclePrimaryDisplayMode("raw", "RGGB", -1), "demosaic");
  assert.equal(shortcuts.cyclePrimaryDisplayMode("remosaic", "QRGGB", 1), "demosaic");
  assert.equal(shortcuts.cyclePrimaryDisplayMode("raw", "MONO", 1), "raw");
  assert.equal(shortcuts.cyclePrimaryDisplayMode("red", "RGGB", 1), "red");
});

test("the main window wires frame and display-mode shortcuts behind interaction guards", () => {
  assert.match(appSource, /if \(event\.defaultPrevented\) return;/);
  assert.match(appSource, /shortcutTargetIsEditable\(event\)[\s\S]*?dialog\[open\][\s\S]*?shortcutMenuIsOpen\(\)/);
  assert.match(appSource, /matchesShortcut\(event, \{ key: "\[" \}\)[\s\S]*?setFrame\(this\.frame - 1\)/);
  assert.match(appSource, /matchesShortcut\(event, \{ key: "\]" \}\)[\s\S]*?setFrame\(this\.frame \+ 1\)/);
  assert.match(appSource, /matchesShortcut\(event, \{ key: "m", shift: true \}\)[\s\S]*?cycleDisplayMode\(-1\)/);
  assert.match(appSource, /matchesShortcut\(event, \{ key: "m" \}\)[\s\S]*?cycleDisplayMode\(1\)/);
  assert.match(appSource, /<span>上一帧 \/ 下一帧<\/span>[\s\S]*?<kbd>\[<\/kbd>[\s\S]*?<kbd>\]<\/kbd>/);
  assert.match(appSource, /<span>下一个 \/ 上一个主要显示模式<\/span>[\s\S]*?<kbd>M<\/kbd>[\s\S]*?<kbd>Shift<\/kbd><kbd>M<\/kbd>/);
});
