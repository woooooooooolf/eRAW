import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { validateReleaseNotes } from "../scripts/validate-release-notes.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [
  packageSource,
  cargoSource,
  cargoLockSource,
  tauriSource,
  appSource,
  helpWindowSource,
  ciSource,
  releaseSource,
  pagesSource,
  dependabotSource,
  contributingSource,
  securitySource,
  supportSource,
  issueConfigSource,
  publicationSource,
  ...readmes
] = await Promise.all([
  read("package.json"),
  read("src-tauri/Cargo.toml"),
  read("src-tauri/Cargo.lock"),
  read("src-tauri/tauri.conf.json"),
  read("src/app.ts"),
  read("src/help-window.ts"),
  read(".github/workflows/ci.yml"),
  read(".github/workflows/release.yml"),
  read(".github/workflows/pages.yml"),
  read(".github/dependabot.yml"),
  read("CONTRIBUTING.md"),
  read("SECURITY.md"),
  read("SUPPORT.md"),
  read(".github/ISSUE_TEMPLATE/config.yml"),
  read("docs/PUBLICATION.md"),
  ...[
    "README.md",
    "README.en.md",
    "README.zh-TW.md",
    "README.ja.md",
    "README.es.md",
    "README.fr.md",
    "README.de.md",
  ].map(read),
]);

const packageJson = JSON.parse(packageSource);
const tauriConfig = JSON.parse(tauriSource);

test("public package metadata and application versions stay synchronized", () => {
  assert.equal(packageJson.version, "0.9.0");
  assert.equal(packageJson.license, "GPL-3.0-or-later");
  assert.equal(packageJson.repository.url, "git+https://github.com/woooooooooolf/eRAW.git");
  assert.equal(tauriConfig.version, packageJson.version);
  assert.match(cargoSource, new RegExp(`version = "${packageJson.version.replaceAll(".", "\\.")}"`));
  assert.match(cargoSource, /rust-version = "1\.90"/);
  assert.match(cargoSource, /repository = "https:\/\/github\.com\/woooooooooolf\/eRAW"/);
  assert.match(appSource, new RegExp(`const VERSION = "${packageJson.version.replaceAll(".", "\\.")}"`));
  assert.match(helpWindowSource, new RegExp(`eRAW V${packageJson.version.replaceAll(".", "\\.")}`));
});

test("community files express a maintenance-focused contribution policy", async () => {
  assert.match(contributingSource, /AI assistance/);
  assert.match(contributingSource, /reproducible defects/i);
  assert.match(contributingSource, /not prioritized/i);
  assert.match(securitySource, /Report a vulnerability/);
  assert.match(supportSource, /response and fix timelines are not guaranteed/);
  assert.match(issueConfigSource, /blank_issues_enabled:\s*false/);
  await assert.rejects(access(new URL("CODE_OF_CONDUCT.md", root)));
});

test("all localized READMEs describe implemented ROI statistics and contribution boundaries", () => {
  for (const source of readmes) {
    assert.match(source, /CONTRIBUTING\.md/);
    assert.match(source, /SECURITY\.md/);
    assert.match(source, /releases\/latest/);
    assert.match(source, /Authenticode/);
    assert.match(source, /SmartScreen/);
    assert.match(source, /SHA-256/);
    assert.doesNotMatch(source, /not yet connected to region statistics|尚未接入区域统计|尚未連接區域統計|領域統計にはまだ接続|todavía no está conectado|n’est pas encore relié|noch nicht mit Bereichsstatistiken/i);
  }
});

test("dependency automation covers npm, Cargo, and GitHub Actions", () => {
  assert.match(dependabotSource, /package-ecosystem:\s*npm/);
  assert.match(dependabotSource, /package-ecosystem:\s*cargo/);
  assert.match(dependabotSource, /package-ecosystem:\s*github-actions/);
  assert.match(packageSource, /"notices":\s*"node scripts\/generate-third-party-notices\.mjs"/);
  assert.doesNotMatch(cargoLockSource, /name = "quick-xml"\r?\nversion = "0\.38\./);
  assert.match(publicationSource, /RUSTSEC-2026-0194/);
  assert.match(publicationSource, /RUSTSEC-2026-0195/);
});

test("workflows pin actions and protect build and release integrity", () => {
  for (const workflow of [ciSource, releaseSource, pagesSource]) {
    const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)].map((match) => match[1]);
    assert.ok(uses.length > 0);
    for (const action of uses) assert.match(action, /@[0-9a-f]{40}$/);
  }
  assert.match(ciSource, /Verify third-party dependency notices/);
  assert.match(ciSource, /npm\.cmd run check:site/);
  assert.match(ciSource, /npm\.cmd run build:site/);
  assert.ok(ciSource.indexOf("run: npm.cmd run release") < ciSource.indexOf("run: npm.cmd run test:cli"));
  assert.ok(releaseSource.indexOf("name: Build release artifacts") < releaseSource.indexOf("run: npm run test:cli"));
  assert.match(releaseSource, /platform: windows/);
  assert.match(releaseSource, /platform: linux/);
  assert.match(releaseSource, /runner: ubuntu-24\.04/);
  assert.match(releaseSource, /needs: build/);
  assert.match(releaseSource, /node scripts\/release-assets\.mjs/);
  assert.match(releaseSource, /node scripts\/publish-release\.mjs/);
  assert.match(releaseSource, /node scripts\/verify-linux-packages\.mjs/);
  assert.match(releaseSource, /node scripts\/validate-release-notes\.mjs/);
  assert.doesNotMatch(releaseSource, /Compress-Archive|\.zip|dependency-graph\/sbom|THIRD_PARTY_LICENSES|--generate-notes/);
  assert.match(releaseSource, /attest-build-provenance@[0-9a-f]{40}/);
  assert.match(releaseSource, /artifacts\/\*\.AppImage/);
  assert.match(releaseSource, /repository\.visibility == 'public'/);
  assert.match(pagesSource, /pages:\s*write/);
  assert.match(pagesSource, /id-token:\s*write/);
  assert.match(pagesSource, /npm run check:site/);
  assert.match(pagesSource, /npm run test:site/);
  assert.match(pagesSource, /npm run build:site/);
  assert.match(pagesSource, /path:\s*\.\/dist-site/);
  assert.match(pagesSource, /name:\s*github-pages/);
  assert.match(publicationSource, /Secret scanning/);
  assert.match(publicationSource, /enforce_admins=false/);
  assert.match(publicationSource, /GHSA-wrw7-89jp-8q8g/);
  assert.match(publicationSource, /DEPENDENCY_PATCHES\.md/);
});

test("glib security backport is pinned to the verified local source and intact", async () => {
  assert.match(cargoSource, /\[patch\.crates-io\][\s\S]*glib = \{ path = "vendor\/glib" \}/);
  const glibLock = cargoLockSource.split("[[package]]").find(section => /\nname = "glib"\r?\n/.test(section));
  assert.ok(glibLock);
  assert.match(glibLock, /version = "0\.18\.5"/);
  assert.doesNotMatch(glibLock, /source\s*=|checksum\s*=/);
  const manifest = JSON.parse(await read("src-tauri/vendor/glib-integrity.json"));
  assert.equal(manifest.crateSha256, "233daaf6e83ae6a12a52055f568f9d7cf4671dabb78ff9560ab6da230ce00ee5");
  assert.equal(manifest.upstreamFix, "05dff0ee696f9bcd8617cd48c4b812d046d440cb");
  const directory = new URL("src-tauri/vendor/glib/", root);
  const actualPaths = [];
  async function walk(prefix = "") {
    for (const item of await readdir(new URL(prefix, directory), { withFileTypes: true })) {
      const path = prefix + item.name;
      if (item.isDirectory()) await walk(path + "/");
      else actualPaths.push(path);
    }
  }
  await walk();
  assert.deepEqual(actualPaths.sort(), manifest.files.map(file => file.path).sort());
  for (const file of manifest.files) {
    const bytes = await readFile(new URL(file.path, directory));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, file.path);
  }
  const patchedSource = await read("src-tauri/vendor/glib/src/variant_iter.rs");
  assert.match(patchedSource, /let mut p: \*mut libc::c_char = std::ptr::null_mut\(\);/);
  assert.match(patchedSource, /\n\s*&mut p,/);
});

test("release notes accept Chinese lists and reject titles, missing sections and generated prose", () => {
  const valid = "### Changed\n\n- 调整 EXE 发布方式。\n\n### Fixed\n\n- 无。\n\n### Docs\n\n- 更新 CLI 文档。\n";
  assert.doesNotThrow(() => validateReleaseNotes(valid));
  assert.doesNotThrow(() => validateReleaseNotes("\uFEFF" + valid.replaceAll("\n", "\r\n")));
  for (const invalid of [
    "", "# eRAW V1.0.0\n" + valid, "更新说明\n" + valid,
    valid.replace("### Fixed\n\n- 无。\n\n", ""),
    valid.replace("- 无。", ""),
    valid.replace("### Fixed", "### Docs"),
    valid.replace("- 无。", "No fixes."),
    valid.replace("- 无。", "- No fixes."),
    valid + "\n完整变更：https://example.com\n",
  ]) assert.throws(() => validateReleaseNotes(invalid));
});
