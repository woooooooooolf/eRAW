import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [apiSource, appSource, viewportSource] = await Promise.all([
  readFile(new URL("../src/api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/viewport.ts", import.meta.url), "utf8"),
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
  const sourceFile = ts.createSourceFile(
    "viewport.ts",
    viewportSource,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  let clearMethod;
  sourceFile.forEachChild((node) => {
    if (!ts.isClassDeclaration(node) || node.name?.text !== "RawViewport") return;
    clearMethod = node.members.find(
      (member) => ts.isMethodDeclaration(member)
        && ts.isIdentifier(member.name)
        && member.name.text === "clearDocument",
    );
  });
  assert.ok(clearMethod && ts.isMethodDeclaration(clearMethod));
  const body = clearMethod.body?.getText(sourceFile) ?? "";
  assert.match(body, /this\.document = null/);
  assert.match(body, /this\.overlayLayer\.clearSelection\(\)/);
  assert.match(body, /this\.clearTextures\(\)/);
  assert.match(body, /this\.callbacks\.onRenderStats\("L0", 0, 0/);
});
