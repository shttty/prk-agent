import assert from "node:assert/strict";
import { probeContract } from "./probe-contract.mjs";

export async function checkDirect(fixture) {
  const { run, catalog, requests, text } = fixture;
  const expected = ["ask", "session_send", "session_result", "kernel_code", "search_default", "search_model_only", "search_resident", "session_spawn", "tool_call", "tool_search"].sort();
  const initial = (await run()).requests[0];
  assert.deepEqual(initial.tools, expected, "First direct request declares exactly resident tools and the two meta tools");
  assert(!initial.declarations.includes("search_lazy"), "Hidden tool schema is absent from the real provider declaration");
  assert(!initial.declarations.includes("search_description"));
  assert.match(initial.prompt, /search_lazy[^\n]*Inspect the cobalt payload\./);
  assert.match(initial.prompt, /search_description[^\n]*Inspect the amber payload\./);
  assert(!initial.prompt.includes("Do not put this second sentence"), "Description fallback is one sentence, not the full tool description");
  assert(initial.prompt.includes(probeContract.guidelines[0]), "Hidden guidelines survive SDK declaration filtering");
  assert.match(initial.prompt, /tool_search\(query\)/);
  assert.match(initial.prompt, /tool_call\(name, args\)/);
  const inventory = await catalog();
  for (const name of ["tool_search", "tool_call"]) {
    assert(!inventory.entries.some((entry) => entry.name === name), "Meta tools are not toggleable catalog entries");
  }
  for (const name of ["kernel_code", "ask", "session_spawn", "session_send", "session_result"]) {
    const entry = inventory.entries.find((entry) => entry.id === `tool:${name}`);
    assert(entry, `Tool ${name} is present`);
    assert.equal(entry.lazy?.defaultEnabled, false, `${name} inherits its ordinary plugin group's resident default`);
  }
  assert.deepEqual(inventory.entries.find((entry) => entry.name === "search_default").lazy, {
    id: "lazy:tool:search_default", enabled: false, defaultEnabled: false, overridden: false, available: true,
  }, "Plugin tools default to their original resident declarations");
  const modelOnly = inventory.entries.find((entry) => entry.name === "search_model_only");
  assert.equal(modelOnly.lazy.available, false, "Model-only tools cannot be executed through tool_call and cannot use lazy loading");
  assert.equal(modelOnly.lazy.enabled, true, "Unavailable model-only settings retain their stored effective value without hiding the declaration");
  const disabled = inventory.entries.find((entry) => entry.name === "search_disabled");
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.lazy.available, false, "Disabled tools retain metadata but cannot use lazy loading or execute");
  assert.equal(disabled.lazy.enabled, true, "Disabled tools also retain their saved effective lazy value");
  const nativeNames = { bash: true, edit: true, find: true, grep: true, ls: true, read: true, write: true };
  for (const entry of inventory.entries) {
    if (entry.id.startsWith("kernel:") || entry.kind === "skill" || nativeNames[entry.name] && entry.group === "group:tools:local") {
      assert.equal(entry.lazy, undefined, `${entry.id} has no tool declaration lazy switch`);
    }
    if (entry.group === "group:tools:library" && entry.lazy?.available) {
      assert.equal(entry.lazy.defaultEnabled, true, `${entry.name} inherits the saved-library lazy default`);
    }
  }
  await run();
  await run();
  for (const query of ["search_laz", "cobalt"]) {
    const { result, execution } = await run("tool_search", { query });
    assert.equal(result.isError, false, text(result));
    assert.deepEqual(execution.result.structuredContent, { tools: [{ name: "search_lazy", description: probeContract.description,
      parameters: probeContract.parameters, promptGuidelines: probeContract.guidelines }] }, "Search returns the complete hidden tool contract without activation");
    assert(text(result).includes("search_lazy"), "Schema search is model-visible, not just structured data");
    assert(text(result).includes('"parameters"'));
  }
  for (const [query, names] of [
    ["amber inventory cobalt UNMATCHED_7042", ["search_description", "search_lazy"]],
    ["search_description cobalt UNMATCHED_7042", ["search_description", "search_lazy"]],
    ["payload UNMATCHED_7042", ["search_lazy", "search_description"]],
  ]) {
    const { result, execution } = await run("tool_search", { query });
    assert.equal(result.isError, false, text(result));
    assert.deepEqual(execution.result.structuredContent.tools.map(({ name }) => name), names,
      "Partial multiword matches rank by matched terms, then name hits, preserving existing order on ties");
  }
  for (const query of ["NO_SUCH_TOOL_7042", "search_resident", "search_disabled"]) {
    const { result, execution } = await run("tool_search", { query });
    assert.equal(result.isError, false);
    assert.deepEqual(execution.result.structuredContent, { tools: [] }, "Search only sees currently hidden enabled tools");
    assert.match(text(result), /no.*match|no.*hidden/i, "No match is explicit");
  }
  for (const request of requests) assert.equal(request.declarations, initial.declarations, "Repeated turns and tool_search preserve the byte-identical complete declarations");
  return initial.declarations;
}
