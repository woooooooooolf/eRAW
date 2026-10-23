// Explicit Release-only checks: never launch a development server or leave a viewer running.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const exe = resolve("src-tauri/target/release", process.platform === "win32" ? "eraw.exe" : "eraw");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const directory = mkdtempSync(join(tmpdir(), "eraw-cli-release-"));
const file = join(directory, "图像 capture = 01.bin");
writeFileSync(file, Buffer.from([0, 32, 64, 96, 128, 160, 192]));
const base = [file, "--width", "4", "--height", "2", "--packing", "unpacked8", "--cfa", "MONO"];
const run = (args) => {
  const result = spawnSync(exe, args, { encoding: "utf8", timeout: 10000, windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
};
test.after(() => rmSync(directory, { recursive: true, force: true }));

test("Release help and version return through inherited stdout", () => {
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Required image parameters:/);
  assert.match(help.stdout, /Preflight checks parameters/);
  assert.equal(help.stderr, "");
  assert.equal(run(["--version"]).stdout.trim(), `eRAW ${version}`);
});

test("Release preflight accepts Unicode paths and reports partial data without a window", () => {
  const result = run(["--check", ...base]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Preflight passed/);
  assert.ok(result.stdout.includes(file));
  assert.match(result.stdout, /Warning \[partial_first_frame\]/);
  assert.match(result.stdout, /Complete frames:\s+0/);
  assert.equal(result.stderr, "");
});

test("Release failures use stderr and distinct argument/file exit statuses", () => {
  const conflict = run(["--check", ...base, "--bit-depth", "12"]);
  assert.equal(conflict.status, 2);
  assert.equal(conflict.stdout, "");
  assert.match(conflict.stderr, /requires a bit depth of 8/);
  const frame = run(["--check", ...base, "--frame", "2"]);
  assert.equal(frame.status, 3);
  assert.match(frame.stderr, /available range 1\.\.1/);
  const missing = run(["--check", ...base.map((v) => v === file ? join(directory, "missing.raw") : v)]);
  assert.equal(missing.status, 3);
  assert.match(missing.stderr, /file_open_failed/);
  assert.match(missing.stderr, /I\/O kind: NotFound/);
  assert.doesNotMatch(missing.stderr, /[\u4e00-\u9fff]/);
});

test("Release resolves relative paths from the caller directory", () => {
  const result = spawnSync(exe, ["--check", ...base.map((v) => v === file ? "图像 capture = 01.bin" : v)], {
    cwd: directory, encoding: "utf8", timeout: 10000, windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(file));
});
