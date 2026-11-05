import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

export function releaseAssetNames(tag, platform) {
  if (!/^V\d+\.\d+\.\d+$/.test(tag)) throw new Error("Expected a Vx.y.z tag");
  const suffixes = platform === "windows" ? ["windows-x64.exe"]
    : platform === "linux" ? ["linux-x64.deb", "linux-x64.AppImage"] : null;
  if (!suffixes) throw new Error("Unsupported release platform");
  return suffixes.map(suffix => `eRAW-${tag}-${suffix}`);
}

export async function prepareReleaseAssets({ tag, platform, targetDirectory, outputDirectory }) {
  const names = releaseAssetNames(tag, platform);
  const expected = names.flatMap(name => [name, `${name}.sha256`]);
  await mkdir(outputDirectory, { recursive: true });
  const unexpected = (await readdir(outputDirectory)).filter(name => !expected.includes(name));
  if (unexpected.length) throw new Error(`Unexpected existing assets: ${unexpected.join(", ")}`);
  const sources = platform === "windows" ? [join(targetDirectory, "release", "eraw.exe")] : await Promise.all(
    [["deb", ".deb"], ["appimage", ".AppImage"]].map(async ([format, suffix]) => {
      const directory = join(targetDirectory, "release", "bundle", format);
      const files = (await readdir(directory)).filter(name => name.endsWith(suffix));
      if (files.length !== 1) throw new Error(`Expected exactly one ${format} bundle, found ${files.length}`);
      return join(directory, files[0]);
    }),
  );
  for (let index = 0; index < names.length; index++) {
    const destination = join(outputDirectory, names[index]);
    await copyFile(sources[index], destination);
    const hash = createHash("sha256").update(await readFile(destination)).digest("hex");
    await writeFile(`${destination}.sha256`, `${hash}  ${names[index]}\n`, "ascii");
  }
  return expected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: {
    platform: { type: "string" }, tag: { type: "string" },
    "target-dir": { type: "string", default: process.env.CARGO_TARGET_DIR ?? "src-tauri/target" },
    "output-dir": { type: "string", default: "artifacts" },
  } });
  const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const tag = values.tag ?? process.env.RELEASE_TAG ?? `V${version}`;
  if (tag !== `V${version}`) throw new Error("Release tag must match the package version");
  const names = await prepareReleaseAssets({
    tag, platform: values.platform ?? (process.platform === "win32" ? "windows" : process.platform),
    targetDirectory: resolve(values["target-dir"]), outputDirectory: resolve(values["output-dir"]),
  });
  console.log(names.join("\n"));
}
