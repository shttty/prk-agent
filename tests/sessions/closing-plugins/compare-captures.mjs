import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export async function compareCaptures(b1, daily, candidate) {
  const json = async (directory, name) => JSON.parse(await readFile(join(directory, name), "utf8"));
  const oldPolicy = { "lazy:tool:ask": false, "lazy:tool:session_list": true, "lazy:tool:session_manage": true };
  const b1Policy = { ...oldPolicy, "lazy:tool:space_status": true,
    ...Object.fromEntries(["skill-tools", "memory", "plugin-config", "terminals"].map((name) => [`lazy:group:tools:package:<inline:${name}>`, true])),
  };
  const b2Policy = { ...b1Policy, "lazy:group:tools:package:<inline:tool-library>": true };
  const manifests = await Promise.all([b1, daily, candidate].map((directory) => json(directory, "manifest.json")));
  for (const [index, policy] of [b1Policy, oldPolicy, b2Policy].entries()) {
    assert.deepEqual(manifests[index].globalCapabilities, policy, "Every capture uses its exact stored deployment policy");
    assert.equal(manifests[index].policy, ["b1", "daily", "b2"][index]);
    assert.deepEqual(Object.keys(manifests[index].modes), ["direct", "code"]);
  }
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
    assert.equal(new Set(sections.map(([name]) => name)).size, sections.length, "Every XML topic occurs once");
    return { sections, gaps };
  };
  const read = async (directory, name, mode) => {
    const [tools, instructions, wire, hook, hooks] = await Promise.all([
      readFile(join(directory, `${name}.tools.json`)), readFile(join(directory, `${name}.instructions.txt`), "utf8"),
      readFile(join(directory, `${name}.http.json`), "utf8"), json(directory, `${name}.hook.json`),
      readFile(join(directory, `${mode}.all-hook-requests.jsonl`), "utf8"),
    ]);
    assert.deepEqual(JSON.parse(wire), hook.payload, "Public hook payload equals actual loopback HTTP body");
    assert(wire.includes(`"tools":${tools.toString("utf8")}`), "Tools artifact keeps exact wire serialization and order");
    assert(wire.includes(`"content":${JSON.stringify(instructions)}`), "Instruction artifact occurs verbatim in raw HTTP");
    assert(hooks.split("\n").filter(Boolean).map((line) => JSON.parse(line)).some((entry) => entry.sessionId === hook.sessionId
      && JSON.stringify(entry.payload) === JSON.stringify(hook.payload)), "Selected request must occur in the preserved real hook stream");
    return { tools, instructions };
  };
  const results = [];
  for (const mode of ["direct", "code"]) for (const depth of ["top-level", "depth-1", "depth-2"]) {
    const name = `${mode}-${depth}`;
    const current = await read(candidate, name, mode), currentParts = split(current.instructions);
    for (const [index, directory] of [b1, daily].entries()) {
      assert.equal(manifests[2].modes[mode].home, manifests[index].modes[mode].home, "All versions reuse the same exact owned fixture home");
      const old = await read(directory, name, mode), oldParts = split(old.instructions);
      const contents = (parts) => JSON.stringify([...parts.sections].sort(([a], [b]) => a.localeCompare(b)));
      results.push({ baseline: index === 0 ? "b1" : "daily", name,
        toolsByteEqual: old.tools.equals(current.tools), instructionsByteEqual: old.instructions === current.instructions,
        sectionContentsByteEqual: contents(oldParts) === contents(currentParts),
        nonSectionBytesEqual: JSON.stringify(oldParts.gaps) === JSON.stringify(currentParts.gaps),
        baselineSectionOrder: oldParts.sections.map(([name]) => name), candidateSectionOrder: currentParts.sections.map(([name]) => name),
        baselineToolOrder: JSON.parse(old.tools).map(({ name }) => name), candidateToolOrder: JSON.parse(current.tools).map(({ name }) => name),
      });
    }
  }
  const report = { normalization: "None. All versions reuse exact fixture homes; only XML topic order may differ. Tools, every XML topic content and every non-topic instruction byte must match both frozen baselines.", results };
  await writeFile(join(candidate, "comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
  for (const result of results) {
    assert(result.toolsByteEqual, `${result.baseline}/${result.name}: exact serialized tools/order changed; see comparison.json`);
    assert(result.sectionContentsByteEqual, `${result.baseline}/${result.name}: XML topic content bytes changed`);
    assert(result.nonSectionBytesEqual, `${result.baseline}/${result.name}: non-topic instruction bytes changed`);
  }
  console.log(JSON.stringify({ ok: true, comparison: report }));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { b1: { type: "string" }, daily: { type: "string" }, candidate: { type: "string" } } });
  assert(values.b1 && values.daily && values.candidate, "Use --b1 DIRECTORY --daily DIRECTORY --candidate DIRECTORY");
  await compareCaptures(values.b1, values.daily, values.candidate);
}
