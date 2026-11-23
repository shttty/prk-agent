import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export async function compareCaptures(baseline, candidate) {
  const manifest = async (directory) => JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  const [before, after] = await Promise.all([manifest(baseline), manifest(candidate)]);
  assert.deepEqual(after.globalCapabilities, before.globalCapabilities, "Both captures must use exactly the same explicit global lazy defaults");
  assert.equal(after.workerTools, before.workerTools);
  const normalize = (instructions, home) => {
    // mkdtemp deliberately isolates each real Gateway/Jupyter run. Only its one
    // exact cwd checkpoint changes; do not scrub IDs, arbitrary paths or tokens.
    const checkpoint = `<cwd>\n${join(home, "project")}\n</cwd>`;
    assert.equal(instructions.split(checkpoint).length, 2, "Normalize exactly one known fixture cwd checkpoint");
    return instructions.replace(checkpoint, "<cwd>\n<OWNED_FIXTURE_CWD>\n</cwd>");
  };
  const split = (instructions) => {
    const sections = [], gaps = [];
    let offset = 0;
    for (const match of instructions.matchAll(/<([a-z][a-z0-9_]*)>\n[\s\S]*?\n<\/\1>/gu)) {
      gaps.push(instructions.slice(offset, match.index));
      sections.push([match[1], match[0]]);
      offset = match.index + match[0].length;
    }
    gaps.push(instructions.slice(offset));
    assert(sections.length, "A real request must contain topic sections");
    assert.equal(new Set(sections.map(([name]) => name)).size, sections.length, "Each topic must occur exactly once");
    return { sections, gaps };
  };
  const results = [];
  for (const name of ["top-level", "depth-1", "depth-2"]) {
    const [oldTools, newTools, oldText, newText] = await Promise.all([
      readFile(join(baseline, `${name}.tools.json`)), readFile(join(candidate, `${name}.tools.json`)),
      readFile(join(baseline, `${name}.instructions.txt`), "utf8"), readFile(join(candidate, `${name}.instructions.txt`), "utf8"),
    ]);
    const oldInstructions = normalize(oldText, before.home), newInstructions = normalize(newText, after.home);
    const oldParts = split(oldInstructions), newParts = split(newInstructions);
    const canonical = (parts) => JSON.stringify([...parts.sections].sort(([a], [b]) => a.localeCompare(b)));
    results.push({ name, toolsByteEqual: oldTools.equals(newTools), instructionsByteEqual: oldInstructions === newInstructions,
      sectionContentsByteEqual: canonical(oldParts) === canonical(newParts),
      nonSectionBytesEqual: JSON.stringify(oldParts.gaps) === JSON.stringify(newParts.gaps),
      baselineSectionOrder: oldParts.sections.map(([name]) => name), candidateSectionOrder: newParts.sections.map(([name]) => name),
      baselineToolOrder: JSON.parse(oldTools).map(({ name }) => name), candidateToolOrder: JSON.parse(newTools).map(({ name }) => name),
    });
  }
  const report = { normalization: "Only the exact <cwd> checkpoint for each manifest's mkdtemp home/project; no other path, ID or token normalization.", results };
  await writeFile(join(candidate, "comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
  for (const result of results) {
    assert(result.toolsByteEqual, `${result.name}: tool declaration bytes and order changed; see comparison.json`);
    assert(result.sectionContentsByteEqual, `${result.name}: instruction section content changed; only section order may differ`);
    assert(result.nonSectionBytesEqual, `${result.name}: instruction bytes outside topic sections changed`);
  }
  console.log(JSON.stringify({ ok: true, comparison: report }));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { baseline: { type: "string" }, candidate: { type: "string" } } });
  assert(values.baseline && values.candidate, "Usage: node compare-captures.mjs --baseline DIRECTORY --candidate DIRECTORY");
  await compareCaptures(values.baseline, values.candidate);
}
