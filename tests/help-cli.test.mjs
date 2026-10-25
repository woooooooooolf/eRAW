import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { renderToString } from "katex";

const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const compile = async (file) => ts.transpileModule(await readFile(new URL(file, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const [base, cli, localized] = await Promise.all([
  compile("../src/help-content.ts"), compile("../src/help-cli.ts"), compile("../src/help-content-localized.ts"),
]);
const { getHelpCatalog } = await import(url(localized
  .replaceAll('"./help-content"', JSON.stringify(url(base)))
  .replaceAll('"./help-cli"', JSON.stringify(url(cli)))));

test("all seven runtime manuals insert exactly one localized CLI article without losing existing pages", () => {
  let examples;
  const original = ["start", "workflow", "layout", "packing", "cfa", "remosaic", "demosaic", "rendering", "inspection", "statistics", "charts", "export", "boundaries", "glossary"];
  const titles = new Set();
  for (const locale of ["en", "zh-CN", "zh-TW", "ja", "es", "fr", "de"]) {
    const catalog = getHelpCatalog(locale);
    assert.equal(catalog.groups.length, 5);
    assert.equal(catalog.sections.length, 15);
    assert.equal(new Set(catalog.sections.map((s) => s.id)).size, 15);
    assert.deepEqual(catalog.sections.filter((s) => s.id !== "cli").map((s) => s.id), original);
    const position = catalog.sections.findIndex((s) => s.id === "cli");
    assert.equal(catalog.sections[position - 1].id, "workflow");
    const page = catalog.sections[position];
    assert.equal(page.group, "guide");
    assert.ok(page.summary.trim());
    titles.add(page.title);
    const commands = page.body.match(/<pre class="help-command">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(commands);
    assert.ok(commands.startsWith("&amp;"));
    assert.ok(commands.includes("--skill"));
    if (examples) assert.equal(commands, examples);
    examples = commands;
  }
  assert.equal(titles.size, 7);
});

test("all seven manuals share identical formulas that render strictly to MathML", () => {
  let reference;
  for(const locale of ["zh-CN","en","zh-TW","ja","es","fr","de"]){
    const formulas=[];
    for(const section of getHelpCatalog(locale).sections){
      for(const match of section.body.matchAll(/<div class="help-latex" data-latex>([\s\S]*?)<\/div>/g)){
        const formula=match[1].replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&amp;","&");
        formulas.push(formula);
        const math=renderToString(formula,{displayMode:true,output:"mathml",strict:"error",throwOnError:true});
        assert.ok(math.includes("<math"));
      }
    }
    assert.equal(formulas.length,36);
    if(reference)assert.deepEqual(formulas,reference);else reference=formulas;
  }
});
