import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [
  packageSource,
  cargoSource,
  tauriSource,
  appSource,
  helpWindowSource,
  ciSource,
  releaseSource,
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
  read("src-tauri/tauri.conf.json"),
  read("src/app.ts"),
  read("src/help-window.ts"),
  read(".github/workflows/ci.yml"),
  read(".github/workflows/release.yml"),
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
  assert.equal(packageJson.version, "0.5.5");
  assert.equal(packageJson.license, "GPL-3.0-or-later");
  assert.equal(packageJson.repository.url, "git+https://github.com/woooooooooolf/eRAW.git");
  assert.equal(tauriConfig.version, packageJson.version);
  assert.match(cargoSource, new RegExp(`version = "${packageJson.version.replaceAll(".", "\\.")}"`));
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
    assert.doesNotMatch(source, /not yet connected to region statistics|尚未接入区域统计|尚未連接區域統計|領域統計にはまだ接続|todavía no está conectado|n’est pas encore relié|noch nicht mit Bereichsstatistiken/i);
  }
});

test("dependency automation covers npm, Cargo, and GitHub Actions", () => {
  assert.match(dependabotSource, /package-ecosystem:\s*npm/);
  assert.match(dependabotSource, /package-ecosystem:\s*cargo/);
  assert.match(dependabotSource, /package-ecosystem:\s*github-actions/);
  assert.match(packageSource, /"notices":\s*"node scripts\/generate-third-party-notices\.mjs"/);
});

test("workflows pin actions and release integrity metadata", () => {
  for (const workflow of [ciSource, releaseSource]) {
    const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)].map((match) => match[1]);
    assert.ok(uses.length > 0);
    for (const action of uses) assert.match(action, /@[0-9a-f]{40}$/);
  }
  assert.match(ciSource, /Verify third-party dependency notices/);
  assert.match(releaseSource, /SHA256SUMS/);
  assert.match(releaseSource, /dependency-graph\/sbom/);
  assert.match(releaseSource, /THIRD_PARTY_LICENSES\.txt/);
  assert.match(releaseSource, /attest-build-provenance@[0-9a-f]{40}/);
  assert.match(releaseSource, /repository\.visibility == 'public'/);
  assert.match(publicationSource, /Secret scanning/);
  assert.match(publicationSource, /enforce_admins=false/);
});
