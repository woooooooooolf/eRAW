import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareReleaseAssets, releaseAssetNames } from "../scripts/release-assets.mjs";
import { publishRelease } from "../scripts/publish-release.mjs";

for (const platform of ["windows", "linux"]) {
  test(`${platform} assets contain only requested formats and matching SHA-256 files`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "eraw-release-"));
    try {
      const targetDirectory = join(directory, "target");
      const outputDirectory = join(directory, "assets");
      const sourcePaths = platform === "windows" ? ["release/eraw.exe"]
        : ["release/bundle/deb/eraw_0.9.0_amd64.deb", "release/bundle/appimage/eraw_0.9.0_amd64.AppImage"];
      for (const path of sourcePaths) {
        const absolute = join(targetDirectory, path);
        await mkdir(join(absolute, ".."), { recursive: true });
        await writeFile(absolute, Buffer.from([0, 255, 42]));
      }
      const args = { tag: "V0.9.0", platform, targetDirectory, outputDirectory };
      const expected = await prepareReleaseAssets(args);
      assert.deepEqual((await readdir(outputDirectory)).sort(), expected.sort());
      for (const name of releaseAssetNames(args.tag, platform)) {
        const hash = createHash("sha256").update(await readFile(join(outputDirectory, name))).digest("hex");
        assert.equal(await readFile(join(outputDirectory, name + ".sha256"), "ascii"), `${hash}  ${name}\n`);
      }
      await prepareReleaseAssets(args);
      await writeFile(join(outputDirectory, "unexpected.zip"), "stale");
      await assert.rejects(prepareReleaseAssets(args), /Unexpected existing assets/);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}

test("unsupported platforms and malformed tags cannot produce release names", () => {
  assert.throws(() => releaseAssetNames("V0.9.0", "darwin"));
  assert.throws(() => releaseAssetNames("../V0.9.0", "linux"));
});

test("publication requires all six valid assets, stages a draft and never overwrites a public release", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eraw-publish-"));
  try {
    const tag = "V0.9.0";
    await mkdir(join(directory, "artifacts"));
    await mkdir(join(directory, "docs/releases"), { recursive: true });
    await writeFile(join(directory, "package.json"), JSON.stringify({ version: "0.9.0" }));
    await writeFile(join(directory, `docs/releases/${tag}.md`), "### Changed\n- 更新 Linux 支持。\n### Fixed\n- 无。\n### Docs\n- 更新文档。\n");
    const files = [];
    for (const platform of ["windows", "linux"]) for (const name of releaseAssetNames(tag, platform)) {
      const bytes = Buffer.from(name);
      await writeFile(join(directory, "artifacts", name), bytes);
      await writeFile(join(directory, "artifacts", name + ".sha256"), `${createHash("sha256").update(bytes).digest("hex")}  ${name}\n`);
      files.push(name, name + ".sha256");
    }
    const commands = [];
    const gh = args => {
      commands.push(args);
      if (args[1] === "list") return "[]";
      if (args[1] === "view") return JSON.stringify({ assets: files.map(name => ({ name })) });
      return "";
    };
    const options = { tag, repository: "example/eraw", directory, gh };
    assert.equal((await publishRelease(options)).length, 6);
    assert.deepEqual(commands.map(command => command[1]), ["list", "create", "upload", "view", "edit"]);
    assert.ok(commands[1].includes("--draft"));
    assert.ok(commands.at(-1).includes("--draft=false"));
    const before = commands.length;
    await assert.rejects(publishRelease({ ...options, gh: args => {
      if (args[1] === "list") return JSON.stringify([{ tagName: tag }]);
      if (args[1] === "view") return JSON.stringify({ isDraft: false, assets: [] });
      throw new Error("Must not mutate a public release");
    } }), /Published releases must not be overwritten/);
    await writeFile(join(directory, "artifacts", files[0]), "corrupt");
    await assert.rejects(publishRelease(options), /Invalid checksum/);
    assert.equal(commands.length, before);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
