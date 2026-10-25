import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source + "\n//# sourceURL=update-check-regression.js").toString("base64")}`;
const modelSource = await readFile(new URL("../src/update-check.ts", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.ts", import.meta.url), "utf8");
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { ManualUpdateChecker, updateCheckMessage, LATEST_RELEASE_URL } = await import(moduleUrl(compile(modelSource)));
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

// Exercise the actual About template and renderer without a desktop or network.
const sourceFile = ts.createSourceFile("app.ts", appSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const appClass = sourceFile.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ErawApp");
const method = name => appClass.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(sourceFile) === name).getText(sourceFile);
const viewSource = `
const LATEST_RELEASE_URL = ${JSON.stringify(LATEST_RELEASE_URL)};
const VERSION = "0.8.0", BUILD_TIME_SOURCE = "test", erawIconUrl = "icon.svg";
const formatDateTime = value => value;
const updateCheckMessage = globalThis.__updateTestMessage;
const t = (key, values) => key + (values?.version ? ":" + values.version : "");
export class AboutView {
  get(id) { return this.elements[id]; }
  ${method("aboutDialogTemplate")}
  ${method("renderUpdateCheck")}
}
`;
const { AboutView } = await import(moduleUrl(compile(viewSource.replace(
  "const updateCheckMessage = globalThis.__updateTestMessage;", `const updateCheckMessage = ${updateCheckMessage.toString()};`,
))));

function view() {
  const result = new AboutView();
  result.elements = Object.fromEntries(["check-updates", "update-check-result", "update-check-message", "update-download", "update-release"]
    .map(id => [id, { hidden: false, disabled: false, textContent: "", href: "", removeAttribute(name) { delete this[name]; } }]));
  return result;
}

test("constructing or rendering the checker does not make a request", () => {
  let calls = 0;
  const about = view();
  about.updateChecker = new ManualUpdateChecker(async () => { calls++; return { status: "current" }; }, () => about.renderUpdateCheck());
  about.renderUpdateCheck();
  assert.equal(calls, 0);
  assert.deepEqual(about.updateChecker.state, { status: "idle" });
  assert.equal(about.elements["update-check-result"].hidden, true);
});

test("closing and reopening About preserves pending and completed request state", async () => {
  const request = deferred();
  const about = view();
  let calls = 0;
  about.updateChecker = new ManualUpdateChecker(() => { calls++; return request.promise; }, () => about.renderUpdateCheck());
  const pending = about.updateChecker.check();
  assert.equal(about.elements["check-updates"].disabled, true);
  const before = about.updateChecker.state;
  // Native dialog visibility changes do not destroy the application model or DOM.
  about.open = false;
  about.open = true;
  about.renderUpdateCheck();
  assert.equal(about.updateChecker.state, before);
  assert.equal(about.elements["check-updates"].textContent, "update.checking");
  assert.equal(about.updateChecker.check(), pending);
  await Promise.resolve();
  assert.equal(calls, 1);
  about.open = false;
  request.resolve({ status: "current" });
  await pending;
  assert.equal(about.open, false);
  assert.equal(about.elements["check-updates"].disabled, false);
  about.open = true;
  about.renderUpdateCheck();
  assert.equal(about.elements["update-check-message"].textContent, "update.current");
  assert.equal(calls, 1);
});

test("network failure while About is closed completes and remains visible on reopening", async () => {
  const request = deferred();
  const about = view();
  about.updateChecker = new ManualUpdateChecker(() => request.promise, () => about.renderUpdateCheck());
  const pending = about.updateChecker.check();
  about.open = false;
  request.reject(new Error("offline"));
  await pending;
  about.open = true;
  about.renderUpdateCheck();
  assert.deepEqual(about.updateChecker.state, { status: "failed", reason: "network" });
  assert.equal(about.elements["update-release"].hidden, false);
  assert.equal(about.elements["update-release"].href, LATEST_RELEASE_URL);
});

test("an unresponsive IPC request has a deadline and late completion cannot revive it", async () => {
  const request = deferred();
  const states = [];
  const checker = new ManualUpdateChecker(() => request.promise, () => states.push(checker.state.status), 20);
  let ticked = false;
  const tick = setTimeout(() => { ticked = true; }, 2);
  await checker.check();
  clearTimeout(tick);
  assert.equal(ticked, true);
  assert.deepEqual(checker.state, { status: "failed", reason: "timeout" });
  request.resolve({ status: "current" });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(checker.state, { status: "failed", reason: "timeout" });
  assert.deepEqual(states, ["checking", "failed"]);
});

test("available links reflect verified targets and disappear during an explicit new check", async () => {
  const result = { status: "available", version: "V0.9.0", downloadAvailable: true,
    releaseUrl: "https://github.com/woooooooooolf/eRAW/releases/tag/V0.9.0",
    downloadUrl: "https://github.com/woooooooooolf/eRAW/releases/download/V0.9.0/eRAW-V0.9.0-windows-x64.zip" };
  const about = view();
  let next = Promise.resolve(result);
  about.updateChecker = new ManualUpdateChecker(() => next, () => about.renderUpdateCheck());
  await about.updateChecker.check();
  assert.equal(about.elements["update-download"].href, result.downloadUrl);
  assert.equal(about.elements["update-download"].hidden, false);
  assert.equal(about.elements["update-release"].href, result.releaseUrl);
  const pendingResult = deferred();
  next = pendingResult.promise;
  const pending = about.updateChecker.check();
  assert.equal(about.elements["update-download"].hidden, true);
  assert.equal(about.elements["update-download"].href, undefined);
  pendingResult.resolve({ ...result, downloadAvailable: false, downloadUrl: null });
  await pending;
  assert.equal(about.elements["update-download"].hidden, true);
  assert.equal(about.elements["update-check-message"].textContent, "update.unconfirmed:V0.9.0");
  const freshProcess = new ManualUpdateChecker(async () => ({ status: "current" }), () => {});
  assert.deepEqual(freshProcess.state, { status: "idle" });
});

test("the manual button belongs only to About and dialog visibility has no reset or request hooks", () => {
  const about = view().aboutDialogTemplate();
  const firstDialog = about.split("</dialog>")[0];
  assert.match(firstDialog, /id="check-updates" type="button"/);
  assert.match(firstDialog, /id="about-done" value="cancel"/);
  assert.doesNotMatch(method("shortcutsDialogTemplate"), /check-updates/);
  assert.deepEqual([...new Set([...appSource.matchAll(/this\.updateChecker\.(\w+)/g)].map(match => match[1]))].sort(), ["check", "state"]);
  assert.match(appSource, /text\("#about-done", "common\.done"\)/);
  assert.doesNotMatch(appSource, /text\("#about-dialog footer button"/);
});
