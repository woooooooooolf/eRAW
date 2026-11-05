import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { releaseAssetNames } from "./release-assets.mjs";
import { validateReleaseNotes } from "./validate-release-notes.mjs";

export async function publishRelease({ tag, repository, directory = process.cwd(), gh }) {
  const version = JSON.parse(await readFile(join(directory, "package.json"), "utf8")).version;
  if (!repository || tag !== `V${version}`) throw new Error("Expected repository and matching version tag");
  const notesPath = join(directory, `docs/releases/${tag}.md`);
  validateReleaseNotes(await readFile(notesPath, "utf8"));
  const assetsDirectory = join(directory, "artifacts");
  const rawNames = ["windows", "linux"].flatMap(platform => releaseAssetNames(tag, platform));
  const expected = rawNames.flatMap(name => [name, name + ".sha256"]).sort();
  const files = (await readdir(assetsDirectory)).sort();
  if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error("Incomplete or unexpected release assets");
  for (const name of rawNames) {
    const hash = createHash("sha256").update(await readFile(join(assetsDirectory, name))).digest("hex");
    if ((await readFile(join(assetsDirectory, name + ".sha256"), "ascii")).trimEnd() !== `${hash}  ${name}`) {
      throw new Error(`Invalid checksum: ${name}`);
    }
  }
  gh ??= args => execFileSync("gh", [...args, "--repo", repository], { encoding: "utf8" });
  // Listing succeeds for an absent release; auth/network failures must abort.
  const releases = JSON.parse(gh(["release", "list", "--limit", "1000", "--json", "tagName"]));
  if (releases.some(release => release.tagName === tag)) {
    const existing = JSON.parse(gh(["release", "view", tag, "--json", "assets,isDraft"]));
    if (!existing.isDraft) throw new Error("Published releases must not be overwritten");
    if (existing.assets.some(asset => !expected.includes(asset.name))) throw new Error("Unexpected draft assets");
  } else {
    gh(["release", "create", tag, "--draft", "--verify-tag", "--title", `eRAW ${tag}`, "--notes-file", notesPath]);
  }
  gh(["release", "upload", tag, ...files.map(file => join(assetsDirectory, file)), "--clobber"]);
  const uploaded = JSON.parse(gh(["release", "view", tag, "--json", "assets"]));
  if (JSON.stringify(uploaded.assets.map(asset => asset.name).sort()) !== JSON.stringify(expected)) {
    throw new Error("Uploaded release asset set does not match the verified set");
  }
  gh(["release", "edit", tag, "--notes-file", notesPath, "--draft=false", "--latest"]);
  return expected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await publishRelease({ tag: process.env.RELEASE_TAG, repository: process.env.GITHUB_REPOSITORY });
  console.log(`Published ${process.env.RELEASE_TAG} with ${files.length} verified assets`);
}
