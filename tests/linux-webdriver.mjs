// Finite smoke test against the built Linux WebKitGTK application, no dev server.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";

if (process.platform !== "linux") throw new Error("Linux WebDriver smoke only");
const binary = resolve(process.env.ERAW_TEST_BINARY ?? join(process.env.CARGO_TARGET_DIR ?? "src-tauri/target", "release/eraw"));
const profile = await mkdtemp(join(tmpdir(), "eraw-webdriver-"));
const output = resolve(process.env.ERAW_TEST_OUTPUT ?? "artifacts/linux-smoke");
await mkdir(output, { recursive: true });
const raw = join(profile, "图像 smoke.raw");
await writeFile(raw, Uint8Array.from({ length: 64 * 32 * 2 }, (_, i) => i % 256));
const port = Number(process.env.ERAW_WEBDRIVER_PORT ?? 4444);
const base = `http://127.0.0.1:${port}`;
let session;
let logs = "";
const driver = spawn(process.env.TAURI_DRIVER ?? join(homedir(), ".cargo/bin/tauri-driver"), ["--port", String(port)], {
  detached: true,
  env: { ...process.env, XDG_DATA_HOME: join(profile, "data"), XDG_CONFIG_HOME: join(profile, "config"), XDG_CACHE_HOME: join(profile, "cache"), LANGUAGE: "en_US", LC_ALL: "C.UTF-8" },
  stdio: ["ignore", "pipe", "pipe"],
});
driver.stdout.on("data", data => { logs += data; });
driver.stderr.on("data", data => { logs += data; });
driver.on("error", error => { logs += String(error); });
async function request(method, path, body) {
  const response = await fetch(base + path, {
    method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const json = await response.json();
  if (!response.ok || json.value?.error) throw new Error(JSON.stringify(json));
  return json.value;
}
const execute = (script, args = []) => request("POST", `/session/${session}/execute/sync`, { script, args });
async function waitFor(predicate, label) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out: ${label}`);
}
try {
  await waitFor(async () => {
    try { await request("GET", "/status"); return true; } catch { return false; }
  }, "driver startup");
  const created = await request("POST", "/session", { capabilities: { alwaysMatch: {
    browserName: "wry", "tauri:options": { application: binary, args: [raw, "--width", "64", "--height", "32", "--packing", "unpacked8", "--cfa", "MONO"] },
  } } });
  session = created.sessionId;
  await waitFor(() => execute('return /[1-9][0-9]* tiles.*0 loading/.test(document.querySelector("#render-status")?.textContent ?? "")'), "first RAW frame rendering");
  assert.equal(await execute('return document.querySelector("#frame-total").textContent'), "2");
  assert.equal(await execute('return document.documentElement.lang'), "en");
  const mainWindow = await request("GET", `/session/${session}/window`);
  await request("POST", `/session/${session}/window/rect`, { width: 960, height: 640 });
  for (const language of ["en", "de"]) {
    await execute('document.querySelector("#language-button").click(); document.querySelector(`[data-language-value="${arguments[0]}"]`).click();', [language]);
    assert.equal(await execute("return document.documentElement.lang"), language);
    const png = await request("GET", `/session/${session}/screenshot`);
    await writeFile(join(output, `linux-${language}-960.png`), Buffer.from(png, "base64"));
  }
  await execute('document.querySelector("#settings-button").click()');
  assert.equal(await execute('return document.querySelector("#settings-dialog").open'), true);
  await execute('document.querySelector("#settings-dialog .secondary-button[value=cancel]").click()');
  await waitFor(() => execute('return !document.querySelector("#settings-dialog").open'), "settings cancel");
  await execute('document.querySelector("#about-button").click(); document.querySelector("#about-menu-item").click()');
  assert.equal(await execute('return document.querySelector("#about-dialog").open && document.querySelector("#update-check-result").hidden'), true);
  await execute('document.querySelector("#about-license").click()');
  await waitFor(() => execute('return document.querySelector("#license-dialog").open && document.querySelector("#license-text").textContent.length > 1000'), "offline license dialog");
  await execute('document.querySelector("#back-from-license").click(); document.querySelector("#about-done").click()');
  await waitFor(() => execute('return !document.querySelector("#about-dialog").open'), "about close");
  await execute('document.querySelector("#next-frame").click()');
  await waitFor(() => execute('return document.querySelector("#frame-input").value === "2" && /0 loading/.test(document.querySelector("#render-status").textContent)'), "second RAW frame");
  await execute('window.dispatchEvent(new KeyboardEvent("keydown", {key:"F1", bubbles:true}))');
  let handles;
  await waitFor(async () => { handles = await request("GET", `/session/${session}/window/handles`); return handles.length >= 2; }, "help window");
  await request("POST", `/session/${session}/window`, { handle: handles.find(handle => handle !== mainWindow) });
  await waitFor(() => execute('return document.querySelectorAll("[data-help-section-content]").length >= 15 && document.documentElement.lang === "de"'), "native help WebView");
  assert.equal(await execute("return document.documentElement.lang"), "de");
  await request("DELETE", `/session/${session}/window`);
  await request("POST", `/session/${session}/window`, { handle: mainWindow });
  await execute('document.querySelector("#open-button").click()');
  await waitFor(() => execute('return document.querySelector("#frame-total").textContent === "0"'), "close document");
  console.log("Linux WebKitGTK: RAW rendering, two frames, English/German, minimum window, settings, About/license, help window and document close passed");
} finally {
  if (session) { try { await request("DELETE", `/session/${session}`); } catch {} }
  if (driver.pid) { try { process.kill(-driver.pid, "SIGTERM"); } catch {} }
  await writeFile(join(output, "webdriver.log"), logs);
  await rm(profile, { recursive: true, force: true });
}
