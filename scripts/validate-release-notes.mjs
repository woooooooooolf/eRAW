import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function validateReleaseNotes(source) {
  const sections = ["Changed", "Fixed", "Docs"];
  let section = -1;
  let items = 0;
  for (const line of source.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line === `### ${sections[section + 1]}`) {
      if (section >= 0 && items === 0) throw new Error("Each section needs a list item (use 无。 if empty).");
      section++;
      items = 0;
    } else if (section >= 0 && /^- \S/.test(line) && /\p{Script=Han}/u.test(line)) {
      items++;
    } else {
      throw new Error("Release notes must contain only ### Changed, ### Fixed, ### Docs and Chinese unordered list items.");
    }
  }
  if (section !== 2 || items === 0) throw new Error("All three sections and their list items are required.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    validateReleaseNotes(await readFile(process.argv[2], "utf8"));
  } catch (error) {
    console.error(`Invalid release notes: ${error.message}`);
    process.exitCode = 1;
  }
}
