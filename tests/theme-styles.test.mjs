import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [themeSource, styleSource] = await Promise.all([
  readFile(new URL("../src/theme-catalog.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
]);
const { outputText } = ts.transpileModule(themeSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const themes = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

function selectorBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styleSource.match(new RegExp(`${escaped}\\s*\\{(?<body>[\\s\\S]*?)\\}`))
    ?.groups?.body ?? "";
}

function variables(block) {
  return new Map(
    [...block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)]
      .map((match) => [match[1], match[2].trim()]),
  );
}

function rgb(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

function contrast(left, right) {
  const luminance = (hex) => {
    const channels = rgb(hex).map((value) => (
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    ));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("theme catalog has unique ids and complete localization keys", () => {
  const ids = themes.THEMES.map(({ id }) => id);
  assert.equal(ids.length, 9);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(new Set(ids), new Set([
    "dark-ocean",
    "dark-violet",
    "dark-amber",
    "light-frost",
    "light-mint",
    "light-sand",
    "dark-contrast",
    "dark-flat",
    "light-flat",
  ]));
  for (const id of ids) {
    assert.equal(themes.isAppTheme(id), true);
    assert.match(themes.themeMessageKey(id), /^theme\.[A-Za-z]+$/);
  }
  assert.equal(themes.isAppTheme("unknown"), false);
});

test("new theme title and surface colors meet readable contrast", () => {
  const required = [
    "--text",
    "--surface-2",
    "--danger-rgb",
    "--section-title-open-color",
    "--section-title-open-bg",
    "--section-title-open-edge",
  ];
  for (const id of ["dark-contrast", "dark-flat", "light-flat"]) {
    const values = variables(selectorBlock(`html[data-theme="${id}"]`));
    for (const name of required) assert.ok(values.has(name), `${id}:${name}`);
    assert.ok(
      contrast(values.get("--text"), values.get("--surface-2")) >= 4.5,
      `${id} normal text contrast`,
    );
    assert.ok(
      contrast(
        values.get("--section-title-open-color"),
        values.get("--section-title-open-bg"),
      ) >= 4.5,
      `${id} section title contrast`,
    );
  }

  const openRule = selectorBlock(".parameter-section.open > .section-title");
  assert.match(openRule, /var\(--section-title-open-bg\)/);
  assert.match(openRule, /var\(--section-title-open-edge\)/);
});
