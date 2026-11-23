import assert from "node:assert/strict";

export async function checkToolSearchPlugin(fixture, worker) {
  const { host, run, action, toggle } = fixture;
  const meta = ["tool_search", "tool_call"];
  const inventory = () => action(worker, "capabilities");
  await toggle(worker, "lazy:group:tools:library", false);
  const resident = (await run(worker)).request;
  const original = resident.tools.find(({ name }) => name === "session_list");
  assert(original, "Start with the real resident session_list definition");
  assert(meta.every((name) => !resident.tools.some((tool) => tool.name === name)), "Meta declarations are absent when no enabled hidden tools exist");
  for (const catalog of [await inventory(), (await host.capabilitiesList()).catalog]) {
    assert(!JSON.stringify(catalog).includes("group:tools:prk"));
    for (const name of meta) assert(!catalog.entries.some((entry) => entry.name === name || entry.id === `tool:${name}`), "Actual meta registrations are not ordinary capability switches");
    assert(!catalog.groups.some(({ id }) => id === "group:tools:package:<inline:tool-search>"));
  }
  const retained = structuredClone(host.state(worker));
  await toggle(worker, "lazy:tool:session_list", true);
  const hidden = (await run(worker)).request;
  assert(!hidden.tools.some(({ name }) => name === "session_list"));
  for (const name of meta) assert(hidden.tools.some((tool) => tool.name === name), `${name} remains reachable while a real tool is hidden`);
  assert.match(hidden.instructions, /<tool_catalog>\n[\s\S]*?^session_list:[\s\S]*?\n<\/tool_catalog>/mu);
  assert.match(hidden.instructions, /tool_search\(query\)/u);
  assert.match(hidden.instructions, /tool_call\(name, args\)/u);
  assert.deepEqual(hidden.tools.filter(({ name }) => !meta.includes(name)), resident.tools.filter(({ name }) => name !== "session_list"), "Lazy policy only removes its target declaration and adds the two meta registrations");
  const searched = await run(worker, "tool_search", { query: "session_list" });
  assert.deepEqual(searched.data, { tools: [{ name: original.name, description: original.description, parameters: original.parameters, promptGuidelines: [] }] }, "Search returns the complete original hidden schema, not manufactured metadata");
  for (const request of searched.requests) assert.equal(JSON.stringify(request.tools), JSON.stringify(hidden.tools), "Schema introspection must not activate or rewrite tools");
  const called = await run(worker, "tool_call", { name: "session_list", args: {} });
  assert(Array.isArray(called.data) && called.data.length > 0, "Meta invocation runs the real list service and sees the separately created session");
  for (const request of called.requests) assert.equal(JSON.stringify(request.tools), JSON.stringify(hidden.tools), "Invocation preserves exact lazy declarations and order");
  await run(worker, "kernel_code", { code: [
    "assert closing_plugin_sentinel == 31847",
    "assert gateway.describe('session_list')['parameters']['type'] == 'object'",
    "assert isinstance(gateway.session_list(), list)",
    "assert isinstance(gateway.call('session_list', {}), list)",
  ].join("\n") });
  await toggle(worker, "tool:session_list", false);
  const disabled = (await run(worker)).request;
  assert(!/^session_list:/mu.test(disabled.instructions), "Disabled tools disappear from the plugin-owned hidden catalog");
  assert(meta.every((name) => !disabled.tools.some((tool) => tool.name === name)), "No-hidden transition hides both meta declarations without unregistering them");
  await toggle(worker, "tool:session_list", true);
  assert((await run(worker)).request.tools.some(({ name }) => name === "tool_search"), "Re-enable immediately restores reachable meta registrations");
  await toggle(worker, "lazy:tool:session_list", null);
  const restored = (await run(worker)).request;
  assert.deepEqual(restored.tools, resident.tools, "Reset restores the original actual definitions and order");
  await toggle(worker, "lazy:group:tools:library", null);
  const current = host.state(worker);
  for (const key of ["streamId", "sessionId"]) assert.equal(current[key], retained[key]);
  assert.equal(current.kernel.kernelId, retained.kernel.kernelId);
  assert.equal((await inventory()).requiresReload, false);
  return { plugin: "tool-search", meta, hiddenTool: "session_list", schemaPreserved: true, nestedCallable: true, noActivation: true };
}
