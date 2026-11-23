import assert from "node:assert/strict";

export async function checkDeclarations(f) {
  const actor = await f.create("Declaration acceptance");
  await f.call(actor, "session_list");
  const initial = f.requests[0];
  const names = initial.tools.map(({ name }) => name);
  for (const name of ["session_spawn", "session_send", "session_result"]) assert(names.includes(name), `${name} is resident on the first direct request`);
  assert.deepEqual(names.filter((name) => name.startsWith("session_")).sort(), ["session_result", "session_send", "session_spawn"]);
  for (const name of ["session_list", "session_manage"]) {
    assert(!names.includes(name), `${name} is hidden by default`);
    assert(initial.prompt.includes(`${name}:`), `${name} remains discoverable`);
    const searched = await f.call(actor, "tool_search", { query: name });
    assert(searched.tools.some((tool) => tool.name === name && tool.parameters), `Search exposes the real ${name} schema`);
    if (name === "session_list") {
      const schema = searched.tools.find((tool) => tool.name === name).parameters;
      assert.deepEqual(Object.keys(schema.properties).sort(), ["limit", "sessionId"]);
      assert.deepEqual(schema.required ?? [], []);
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual([schema.properties.limit.type, schema.properties.limit.minimum, schema.properties.limit.maximum, schema.properties.limit.default], ["integer", 1, 20, 6]);
    }
  }
  const old = ["agent_send", "agent_list", "session_children", "session_destroy", "session_transfer", "session_accept_transfer", "session_set_project", "session_acknowledge"];
  const catalog = await f.client.request("capabilitiesList");
  assert.deepEqual(catalog.catalog.entries.filter((entry) => entry.name.startsWith("session_")).map((entry) => entry.name).sort(), ["session_list", "session_manage", "session_result", "session_send", "session_spawn"], "The complete public session catalog contains exactly five tools");
  for (const name of old) {
    assert(!names.includes(name));
    assert(!catalog.catalog.entries.some((entry) => entry.name === name), `No legacy catalog alias ${name}`);
    assert(!(await f.call(actor, "tool_search", { query: name })).tools.some((tool) => tool.name === name), `No legacy discoverable alias ${name}`);
  }
  const resident = ["session_spawn", "session_send", "session_result"];
  for (const name of [...resident, "session_list", "session_manage"]) {
    const entry = catalog.catalog.entries.find((entry) => entry.name === name);
    assert(entry, `${name} has one capability entry`);
    assert.equal(entry.lazy.enabled, !resident.includes(name));
  }
  const result = await f.call(actor, "kernel_code", { code: `import json\nold = ${JSON.stringify(old)}\nnames = {item['name'] for item in gateway.describe()}\nassert not names.intersection(old), names.intersection(old)\nassert {"session_spawn", "session_send", "session_result", "session_list", "session_manage"}.issubset(names)\nassert isinstance(gateway.session_list(), list)\nassert gateway.call('session_list', {}) == gateway.session_list()\nfor name in old:\n    try:\n        gateway.call(name, {})\n    except RuntimeError:\n        pass\n    else:\n        raise AssertionError('legacy callback remained callable: ' + name)` });
  assert(result.details.callbacks.some(({ name, status }) => name === "session_list" && status === "ok"));
  return actor;
}
