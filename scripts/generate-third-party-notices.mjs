import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const inventoryPath = join(root, "THIRD_PARTY_NOTICES.md");
const licenseOutputIndex = process.argv.indexOf("--licenses");
const licenseOutputPath = licenseOutputIndex >= 0 ? resolve(root, process.argv[licenseOutputIndex + 1] ?? "") : null;

if (licenseOutputIndex >= 0 && !process.argv[licenseOutputIndex + 1]) {
  throw new Error("--licenses requires an output path");
}

const packageLock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const npmPackages = Object.entries(packageLock.packages ?? {})
  .filter(([packagePath]) => packagePath)
  .map(([packagePath, metadata]) => {
    const manifestPath = join(root, packagePath, "package.json");
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
    return {
      ecosystem: "npm",
      name: manifest.name ?? packagePath.split("node_modules/").at(-1),
      version: metadata.version ?? manifest.version ?? "unknown",
      license: metadata.license ?? manifest.license ?? "NOASSERTION",
      scope: metadata.dev ? "development" : metadata.optional ? "optional" : "runtime",
      directory: join(root, packagePath),
      licenseFile: null,
    };
  })
  .sort(comparePackages);

const cargoMetadata = JSON.parse(execFileSync("cargo", [
  "metadata",
  "--locked",
  "--format-version", "1",
  "--manifest-path", join(root, "src-tauri", "Cargo.toml"),
], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

const rustPackages = cargoMetadata.packages
  .filter((metadata) => metadata.name !== "eraw")
  .map((metadata) => ({
    ecosystem: "Cargo",
    name: metadata.name,
    version: metadata.version,
    license: metadata.license ?? "NOASSERTION",
    scope: "locked dependency",
    directory: dirname(metadata.manifest_path),
    licenseFile: metadata.license_file,
  }))
  .sort(comparePackages);

const markdown = [
  "# Third-party dependency notices",
  "",
  "This file is generated from `package-lock.json` and `src-tauri/Cargo.lock` by `npm.cmd run notices`. Do not edit it manually.",
  "",
  "It records the complete locked dependency inventory and each package's declared license expression. License and notice texts discoverable in the installed dependency sources are collected into `THIRD_PARTY_LICENSES.txt` for release artifacts.",
  "",
  "eRAW itself is distributed under GPL-3.0-or-later. Dependency copyrights remain with their respective owners.",
  "",
  `## npm dependencies (${npmPackages.length})`,
  "",
  "| Package | Version | Scope | Declared license |",
  "| --- | --- | --- | --- |",
  ...npmPackages.map((entry) => `| ${escapeCell(entry.name)} | ${escapeCell(entry.version)} | ${entry.scope} | ${escapeCell(entry.license)} |`),
  "",
  `## Cargo dependencies (${rustPackages.length})`,
  "",
  "| Crate | Version | Declared license |",
  "| --- | --- | --- |",
  ...rustPackages.map((entry) => `| ${escapeCell(entry.name)} | ${escapeCell(entry.version)} | ${escapeCell(entry.license)} |`),
  "",
].join("\n");

writeFileSync(inventoryPath, markdown, "utf8");

if (licenseOutputPath) {
  const licenseGroups = new Map();
  const missingTexts = [];
  for (const dependency of [...npmPackages, ...rustPackages]) {
    const files = findLicenseFiles(dependency);
    if (!files.length) {
      missingTexts.push(`${dependency.ecosystem}: ${dependency.name}@${dependency.version} (${dependency.license})`);
      continue;
    }
    for (const file of files) {
      const content = readFileSync(file, "utf8").replace(/\r\n/g, "\n").trim();
      if (!content) continue;
      const hash = createHash("sha256").update(content).digest("hex");
      const group = licenseGroups.get(hash) ?? { content, packages: new Set(), files: new Set() };
      group.packages.add(`${dependency.ecosystem}: ${dependency.name}@${dependency.version} (${dependency.license})`);
      group.files.add(relative(dependency.directory, file).replaceAll("\\", "/"));
      licenseGroups.set(hash, group);
    }
  }

  const text = [
    "eRAW third-party license and notice texts",
    "============================================",
    "",
    "Generated from the exact npm and Cargo lockfiles used by this source revision.",
    "eRAW itself is licensed under GPL-3.0-or-later; see LICENSE.",
    "",
    ...[...licenseGroups.values()].sort((a, b) => [...a.packages][0].localeCompare([...b.packages][0])).flatMap((group) => [
      "-------------------------------------------------------------------------------",
      `Packages: ${[...group.packages].sort().join(", ")}`,
      `Files: ${[...group.files].sort().join(", ")}`,
      "-------------------------------------------------------------------------------",
      group.content,
      "",
    ]),
    ...(missingTexts.length ? [
      "-------------------------------------------------------------------------------",
      "Packages whose installed source does not provide a discoverable license/notice text",
      "-------------------------------------------------------------------------------",
      ...missingTexts.sort(),
      "",
    ] : []),
  ].join("\n");

  mkdirSync(dirname(licenseOutputPath), { recursive: true });
  writeFileSync(licenseOutputPath, text, "utf8");
}

function comparePackages(a, b) {
  return a.name.localeCompare(b.name) || a.version.localeCompare(b.version);
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function findLicenseFiles(dependency) {
  const candidates = new Set();
  if (dependency.licenseFile) {
    const explicit = resolve(dependency.directory, dependency.licenseFile);
    if (existsSync(explicit) && statSync(explicit).isFile()) candidates.add(explicit);
  }
  if (!existsSync(dependency.directory)) return [...candidates];
  for (const name of readdirSync(dependency.directory)) {
    if (!/^(licen[cs]e|copying|notice|unlicense)([-._].*)?$/i.test(name)) continue;
    const candidate = join(dependency.directory, name);
    if (statSync(candidate).isFile()) candidates.add(candidate);
  }
  return [...candidates].sort();
}
