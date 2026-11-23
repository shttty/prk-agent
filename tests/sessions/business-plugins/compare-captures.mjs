import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export async function compareCaptures(baseline, candidate) {
  const json = async (directory, name) => JSON.parse(await readFile(join(directory, name), "utf8"));
  const [before, after] = await Promise.all([json(baseline, "manifest.json"), json(candidate, "manifest.json")]);
  const oldPolicy = { "lazy:tool:ask": false, "lazy:tool:session_list": true, "lazy:tool:session_manage": true };
  const newPolicy = { ...oldPolicy, "lazy:tool:space_status": true,
    ...Object.fromEntries(["skill-tools", "memory", "plugin-config", "terminals"].map((name) => [`lazy:group:tools:package:<inline:${name}>`, true])),
  };
  assert.deepEqual(before.globalCapabilities, oldPolicy, "Baseline must use actual old defaults plus its stored resident ask/session policy");
  assert.deepEqual(after.globalCapabilities, newPolicy, "Candidate must add exactly the requested explicit B1 deployment defaults");
  for (const manifest of [before, after]) assert.deepEqual(Object.keys(manifest.modes), ["direct", "code"]);
  const split = (instructions) => {
    const sections = [], gaps = [];
    let offset = 0;
    for (const match of instructions.matchAll(/<([a-z][a-z0-9_]*)>\n[\s\S]*?\n<\/\1>/gu)) {
      gaps.push(instructions.slice(offset, match.index));
      sections.push([match[1], match[0]]);
      offset = match.index + match[0].length;
    }
    gaps.push(instructions.slice(offset));
    assert(sections.length, "A real request must contain complete XML topics");
    assert.equal(new Set(sections.map(([name]) => name)).size, sections.length, "Every XML topic occurs exactly once");
    return { sections, gaps };
  };
  const read = async (directory, name) => {
    const [tools, instructions, wire, hook] = await Promise.all([
      readFile(join(directory, `${name}.tools.json`)), readFile(join(directory, `${name}.instructions.txt`), "utf8"),
      readFile(join(directory, `${name}.http.json`), "utf8"), json(directory, `${name}.hook.json`),
    ]);
    assert.deepEqual(JSON.parse(wire), hook.payload, "Saved public before_provider_request payload must equal the received loopback HTTP body");
    assert(wire.includes(`"tools":${tools.toString("utf8")}`), "Tools artifact must preserve exact wire serialization and declaration order");
    assert(wire.includes(`"content":${JSON.stringify(instructions)}`), "Instructions artifact must occur verbatim in the raw HTTP payload");
    return { tools, instructions };
  };
  const results = [];
  for (const mode of ["direct", "code"]) for (const depth of ["top-level", "depth-1", "depth-2"]) {
    const name = `${mode}-${depth}`;
    const [old, current] = await Promise.all([read(baseline, name), read(candidate, name)]);
    assert.equal(after.modes[mode].home, before.modes[mode].home, "Candidate must reuse the exact baseline owned fixture home");
    const oldText = old.instructions, newText = current.instructions;
    const oldParts = split(oldText), newParts = split(newText);
    const content = (parts) => JSON.stringify([...parts.sections].sort(([a], [b]) => a.localeCompare(b)));
    results.push({ name, toolsByteEqual: old.tools.equals(current.tools), instructionsByteEqual: oldText === newText,
      sectionContentsByteEqual: content(oldParts) === content(newParts), nonSectionBytesEqual: JSON.stringify(oldParts.gaps) === JSON.stringify(newParts.gaps),
      baselineSectionOrder: oldParts.sections.map(([name]) => name), candidateSectionOrder: newParts.sections.map(([name]) => name),
      baselineToolOrder: JSON.parse(old.tools).map(({ name }) => name), candidateToolOrder: JSON.parse(current.tools).map(({ name }) => name),
    });
  }
  const report = { normalization: "None. Candidate reuses exact baseline fixture homes; tools and every topic/non-topic instruction byte are compared without substitution. Only XML topic order may differ.", results };
  await writeFile(join(candidate, "comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
  for (const result of results) {
    assert(result.toolsByteEqual, `${result.name}: exact serialized tools/order changed; see comparison.json`);
    assert(result.sectionContentsByteEqual, `${result.name}: XML topic content bytes changed`);
    assert(result.nonSectionBytesEqual, `${result.name}: non-topic instruction bytes changed`);
  }
  console.log(JSON.stringify({ ok: true, comparison: report }));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { baseline: { type: "string" }, candidate: { type: "string" } } });
  assert(values.baseline && values.candidate, "Use --baseline DIRECTORY --candidate DIRECTORY");
  await compareCaptures(values.baseline, values.candidate);
}
