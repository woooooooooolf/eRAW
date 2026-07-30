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

function resolvedThemeVariables(theme) {
  const result = variables(selectorBlock(":root"));
  if (theme.startsWith("light-")) {
    for (const [name, value] of variables(selectorBlock('html[data-theme^="light-"]'))) {
      result.set(name, value);
    }
  }
  for (const [name, value] of variables(selectorBlock(`html[data-theme="${theme}"]`))) {
    result.set(name, value);
  }
  return result;
}

function resolvedValue(values, name) {
  let value = values.get(name);
  const visited = new Set([name]);
  while (value?.startsWith("var(")) {
    const target = value.match(/^var\((--[a-z0-9-]+)\)$/)?.[1];
    assert.ok(target, `${name} has an unsupported reference`);
    assert.equal(visited.has(target), false, `${name} has a circular reference`);
    visited.add(target);
    value = values.get(target);
  }
  assert.ok(value, `${name} is defined`);
  return value;
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

test("every theme keeps primary, secondary, and tertiary text readable", () => {
  const required = [
    "--text",
    "--muted",
    "--dim",
    "--surface-0",
    "--surface-2",
    "--section-title-open-color",
    "--section-title-open-bg",
  ];
  for (const id of themes.THEMES.map(({ id }) => id)) {
    const values = resolvedThemeVariables(id);
    for (const name of required) assert.ok(values.has(name), `${id}:${name}`);
    const surface = resolvedValue(values, "--surface-2");
    for (const name of ["--text", "--muted", "--dim"]) {
      assert.ok(
        contrast(resolvedValue(values, name), surface) >= 4.5,
        `${id} ${name} contrast`,
      );
    }
    const openBackground = resolvedValue(values, "--section-title-open-bg");
    const resolvedBackground = openBackground === "transparent"
      ? resolvedValue(values, "--surface-0")
      : openBackground;
    assert.ok(
      contrast(resolvedValue(values, "--section-title-open-color"), resolvedBackground) >= 4.5,
      `${id} section title contrast`,
    );
  }

  const openRule = selectorBlock(".parameter-section.open > .section-title");
  assert.match(openRule, /var\(--section-title-open-bg\)/);
  assert.match(openRule, /var\(--section-title-open-edge\)/);
});

test("theme choices keep full labels available at wide and compact widths", () => {
  const popover = selectorBlock(".theme-popover");
  const options = selectorBlock(".theme-options");
  assert.match(popover, /width:\s*540px/);
  assert.match(options, /grid-template-columns:\s*repeat\(2,/);
  assert.match(
    styleSource,
    /@media \(max-width:\s*1120px\)[\s\S]*?\.theme-popover\s*\{\s*width:\s*304px/,
  );
  assert.match(
    styleSource,
    /@media \(max-width:\s*1120px\)[\s\S]*?\.theme-options\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
});
