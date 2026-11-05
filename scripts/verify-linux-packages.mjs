import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (process.platform !== "linux" || process.arch !== "x64") throw new Error("Requires Linux x64");
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const skill = (await readFile("skill/eraw-viewer/SKILL.md", "utf8")).replaceAll("\r\n", "\n");
const target = resolve(process.env.CARGO_TARGET_DIR ?? "src-tauri/target", "release/bundle");
async function bundle(format, suffix) {
  const directory = join(target, format);
  const files = (await readdir(directory)).filter(name => name.endsWith(suffix));
  assert.equal(files.length, 1, `Expected one ${format} bundle`);
  return join(directory, files[0]);
}
const deb = await bundle("deb", ".deb");
const image = await bundle("appimage", ".AppImage");
const run = (file, args, options = {}) => execFileSync(file, args, { encoding: "utf8", timeout: 60000, maxBuffer: 32 * 1024 * 1024, ...options });
assert.equal(run("dpkg-deb", ["-f", deb, "Version"]).trim(), version);
assert.equal(run("dpkg-deb", ["-f", deb, "Architecture"]).trim(), "amd64");
assert.match(run("dpkg-deb", ["-f", deb, "Depends"]), /libwebkit2gtk-4\.1-0/);
assert.match(run("dpkg-deb", ["-f", deb, "Depends"]), /libssl3t64/);
const directory = await mkdtemp(join(tmpdir(), "eraw-package-check-"));
try {
  run("dpkg-deb", ["-x", deb, directory]);
  const binary = join(directory, "usr/bin/eraw");
  assert.equal(run(binary, ["--version"]).trim(), `eRAW ${version}`);
  assert.match(run(binary, ["--help"]), /Required image parameters:/);
  assert.equal(run(binary, ["--skill"]).replaceAll("\r\n", "\n"), skill);
  const applications = join(directory, "usr/share/applications");
  const desktopFiles = (await readdir(applications)).filter(name => name.endsWith(".desktop"));
  assert.equal(desktopFiles.length, 1);
  const desktop = await readFile(join(applications, desktopFiles[0]), "utf8");
  assert.match(desktop, /^Exec=eraw(?:\s|$)/m);
  assert.match(desktop, /^Icon=.+/m);
  await chmod(image, 0o755);
  assert.equal(run(image, ["--version"], {
    env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: "1" },
  }).trim(), `eRAW ${version}`);
  run(image, ["--appimage-extract"], { cwd: directory });
  const appdir = join(directory, "squashfs-root");
  assert.equal(run(join(appdir, "AppRun"), ["--version"], {
    env: { ...process.env, APPDIR: appdir, APPIMAGE: image },
  }).trim(), `eRAW ${version}`);
  assert.equal(run(join(appdir, "AppRun"), ["--skill"], {
    env: { ...process.env, APPDIR: appdir, APPIMAGE: image },
  }).replaceAll("\r\n", "\n"), skill);
  assert.ok((await readdir(appdir)).some(name => name.endsWith(".desktop")));
  console.log("DEB metadata, desktop entry, extracted binary and AppImage AppRun verified");
} finally { await rm(directory, { recursive: true, force: true }); }
