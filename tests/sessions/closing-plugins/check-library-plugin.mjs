import { parse } from "smol-toml";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkLibraryPlugin(fixture, worker, home) {
  const { host, run, action, toggle } = fixture;
  const saved = "prk_saved_closing_increment", group = "group:tools:library";
  const callbacks = ["prk_library_save", "prk_library_access", "prk_library_used", "prk_library_available"];
  const catalog = () => action(worker, "capabilities");
  const entry = (inventory) => inventory.entries.find(({ name }) => name === saved);
  const inventory = await catalog();
  assert(!inventory.entries.some(({ name }) => name === saved), "Saved capability must be dynamically created by real persistence");
  const persisted = await run(worker, "kernel_code", { code: [
    "@tool(persist=True, reason='Increment recurring closing-plugin arithmetic inputs.')",
    "def closing_increment(value: int):",
    "    '''Increment a reusable integer input.'''",
    "    return value + 1",
    "assert closing_increment(41) == 42",
    "assert any(item['name'] == 'closing_increment' for item in library_sync())",
    "closing_reference = closing_increment",
  ].join("\n") });
  for (const name of callbacks) assert(persisted.result.details.callbacks.some((call) => call.name === name && call.status === "ok"), `${name} must execute through the real prelude/SDK callback path`);
  for (const request of persisted.requests) {
    assert(!request.tools.some(({ name }) => callbacks.includes(name)), "Prelude-only callbacks must never become model declarations");
    assert(!callbacks.some((name) => request.instructions.includes(name)), "Internal callbacks stay out of the model instruction catalog");
  }
  const stored = () => host.toolsList("fixture").tools.find(({ name }) => name === "closing_increment");
  assert.equal(stored().successfulCalls, 1);
  assert.equal(stored().distinctSessions, 1);
  assert.equal(stored().available, true);
  assert.match(stored().source, /return value \+ 1/u, "Library contains inspected real Python source");
  const initial = await catalog(), state = structuredClone(host.state(worker));
  assert.equal(entry(initial).group, group, "User-saved tools retain their independent library identity");
  assert.equal(entry(initial).source, "tool-library");
  assert.equal(entry(initial).exposure, "codemode");
  assert.equal(entry(initial).lazy.defaultEnabled, true);
  assert.equal(entry(initial).lazy.enabled, true);
  for (const current of [initial, (await host.capabilitiesList()).catalog]) {
    assert(!JSON.stringify(current).includes("group:tools:prk"));
    assert(!current.entries.some(({ name }) => [...callbacks, "tool_save", "tool_remove"].includes(name)));
    assert(!current.groups.some(({ id }) => id === "group:tools:package:<inline:tool-library>"), "No fake ordinary management group rows");
  }
  const config = structuredClone(parse(await readFile(join(home, "config.toml"), "utf8")));
  assert.equal(config.session.capabilities["lazy:group:tools:package:<inline:tool-library>"], true, "Store the requested B2 default even though B1 has no ordinary library-management tools");
  const observe = async (hidden) => {
    const request = (await run(worker)).request, current = await catalog();
    assert(!request.tools.some(({ name }) => callbacks.includes(name)), "Saved-tool lazy transitions do not expose internal callbacks");
    assert.equal(request.tools.some(({ name }) => name === saved), !hidden);
    assert.equal(new RegExp(`^${saved}:`, "mu").test(request.instructions), hidden);
    assert.equal(entry(current).enabled, true);
    assert.equal(entry(current).exposure, "codemode", "Lazy policy does not rewrite registration exposure");
    assert.equal(entry(current).lazy.enabled, hidden);
    assert.equal(current.requiresReload, false);
  };
  await observe(true);
  const invoked = await run(worker, "tool_call", { name: saved, args: { args: [9] } }, false, { parseJson: false });
  assert.match(invoked.text, /\b10\b/u);
  assert.equal(stored().successfulCalls, 2, "Idle meta invocation records exactly one real saved-tool use");
  await toggle(worker, `lazy:${group}`, false);
  await observe(false);
  await toggle(worker, `lazy:tool:${saved}`, true);
  await observe(true);
  await toggle(worker, `lazy:tool:${saved}`, null);
  await observe(false);
  await toggle(worker, `lazy:${group}`, null);
  await toggle(worker, "lazy:tool:session_list", true);
  await toggle(worker, group, false);
  const off = (await run(worker)).request;
  assert(!off.tools.some(({ name }) => name === saved));
  assert(!off.instructions.includes(`${saved}:`));
  for (const [tool, args] of [[saved, { args: [9] }], ["tool_call", { name: saved, args: { args: [9] } }]]) {
    assert.match((await run(worker, tool, args, true)).text, new RegExp(`${saved} 在本会话已关闭`, "u"));
  }
  await run(worker, "kernel_code", { code: [
    "assert closing_plugin_sentinel == 31847",
    `assert not any(item['name'] == '${saved}' for item in gateway.describe())`,
    "try: closing_reference(9)",
    "except RuntimeError as error: assert 'disabled' in str(error), str(error)",
    "else: raise AssertionError('disabled saved Python function executed')",
  ].join("\n") });
  assert.equal(stored().successfulCalls, 2, "Denied executions cannot fabricate successful uses");
  await toggle(worker, group, true);
  await run(worker, "kernel_code", { code: "assert closing_plugin_sentinel == 31847\nassert closing_reference(9) == 10" });
  assert.equal(stored().successfulCalls, 3);
  await toggle(worker, "lazy:tool:session_list", null);
  const fresh = (await host.createSession({ target: "fixture", label: "Persisted library proof" })).session.sessionId;
  await run(fresh, "kernel_code", { code: "assert closing_increment(99) == 100\nassert any(item['name'] == 'closing_increment' for item in library_sync())" });
  assert.equal(stored().successfulCalls, 4);
  assert.equal(stored().distinctSessions, 2, "A separate native SDK session loads and executes actual stored source");
  for (const key of ["streamId", "sessionId"]) assert.equal(host.state(worker)[key], state[key]);
  assert.equal(host.state(worker).kernel.kernelId, state.kernel.kernelId);
  return { plugin: "tool-library", callbacks, savedGroup: group, persistedUses: 4, distinctSessions: 2, independentSavedPolicy: true };
}
