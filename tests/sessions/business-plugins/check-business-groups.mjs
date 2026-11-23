import { parse } from "smol-toml";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { checkRestoredTools } from "./check-restored-tools.mjs";

export async function checkBusinessGroups(fixture, worker, home) {
  const { host, run, action, toggle } = fixture;
  const groups = [
    { name: "ask", tools: { ask: { questions: [{ id: "proof", question: "Continue?", options: [{ label: "Yes" }] }] } }, section: "ask" },
    { name: "skill-tools", tools: { skill_manage: { action: "delete", name: "never-created" }, skill_read: { path: join(home, "never-read", "SKILL.md") } }, section: "skill_tools" },
    { name: "memory", tools: { memory: { target: "memory", action: "add", content: "Must not be saved by a disabled plugin." } }, section: "memory" },
    { name: "plugin-config", tools: { plugin_config: { action: "get", provider: "business-proof" } } },
    { name: "terminals", tools: { terminal_list: {}, terminal_textsend: { text: "printf NEVER_RUN_B1", name: "business-proof" }, terminal_keysend: { keys: "C-c", name: "business-proof" }, terminal_read: { name: "business-proof" }, terminal_set: { name: "business-proof", quiet_notify: true }, terminal_close: { name: "business-proof" } } },
    { name: "sessions", tools: { space_status: {} }, section: "sessions" },
  ].map((group) => ({ ...group, id: `group:tools:package:<inline:${group.name}>` }));
  const catalog = () => action(worker, "capabilities");
  const member = (inventory, name) => inventory.entries.find(({ id }) => id === `tool:${name}`);
  const assertOrigins = (inventory) => {
    for (const group of groups) {
      assert(inventory.groups.some(({ id }) => id === group.id), `${group.name} must be its own public inline plugin group`);
      assert.equal(inventory.groups.find(({ id }) => id === group.id).name, group.name, "Inline markers stay in identity, not the display label");
      for (const name of Object.keys(group.tools)) {
        const entry = member(inventory, name);
        assert(entry, `Stable tool:${name} capability must exist`);
        assert.equal(entry.group, group.id, `${name} belongs to its inline plugin factory`);
        assert.equal(entry.groupLabel, group.name);
        assert.equal(entry.source, group.name);
      }
    }
  };
  assertOrigins((await host.capabilitiesList()).catalog);
  const initial = await catalog();
  assertOrigins(initial);
  for (const group of groups) {
    const state = initial.groups.find(({ id }) => id === group.id);
    assert.equal(state.lazy.defaultEnabled, false, "Generic plugins are resident without explicit global policy");
    assert.equal(state.lazy.enabled, false);
    for (const name of Object.keys(group.tools)) assert.equal(member(initial, name).lazy.enabled, false);
  }
  const section = (request, name) => new RegExp(`<${name}>\\n([\\s\\S]*?)\\n</${name}>`, "u").exec(request.instructions)?.[1];
  let discoveryAnchor;
  const observe = async (selected, enabled, lazy) => {
    const request = (await run(worker)).request, inventory = await catalog();
    assert.equal(inventory.requiresReload, false);
    for (const group of groups) {
      const on = group === selected ? enabled : true;
      assert.equal(inventory.groups.find(({ id }) => id === group.id).enabled, on);
      if (group.section) assert.equal(Boolean(section(request, group.section)), on, `${group.section} follows only its own plugin switch`);
      for (const name of Object.keys(group.tools)) {
        const hidden = (group === selected && lazy) || name === discoveryAnchor;
        const entry = member(inventory, name);
        assert.equal(entry.enabled, on, `${name} enabled state`);
        assert.equal(entry.exposure, member(initial, name).exposure, `${name} registration exposure is immutable`);
        assert.equal(request.tools.some((tool) => tool.name === name), on && !hidden, `${name} next real HTTP declaration`);
        const listed = new RegExp(`^${name}:`, "mu").test(request.instructions);
        assert.equal(listed, on && hidden, `${name} hidden catalog must exclude disabled tools and include lazy tools`);
        if (on) assert.equal(entry.lazy.enabled, hidden, `${name} lazy state`);
      }
    }
    for (const group of groups) {
      if (group === selected || !group.section) continue;
      assert.equal(section(request, group.section), section(resident, group.section), "An independent group switch must preserve other topic bytes");
    }
    return request;
  };
  const resident = (await run(worker)).request;
  await run(worker, "kernel_code", { code: "business_plugin_sentinel = 71039" });
  const retained = structuredClone(host.state(worker));
  assert(retained.kernel?.kernelId, "Retention proof requires a real live kernel");
  const results = [];
  for (const group of groups) {
    // tool_call is active only while a real enabled hidden tool exists. Keep an
    // independent group lazy, never the group whose permission is being tested.
    discoveryAnchor = group.name === "sessions" ? "skill_read" : "session_list";
    await action(worker, "capabilities", { changes: ["session_list", "skill_read"].map((name) => ({ id: `lazy:tool:${name}`, enabled: name === discoveryAnchor ? true : null })) });
    await toggle(worker, group.id, false);
    await observe(group, false, false);
    for (const [tool, args] of Object.entries(group.tools)) {
      for (const [name, input] of [[tool, args], ["tool_call", { name: tool, args }]]) {
        const denied = await run(worker, name, input, true);
        assert.match(denied.text, new RegExp(`${tool} 在本会话已关闭`, "u"), "Direct and meta calls must share the permission hook");
      }
    }
    const denied = await run(worker, "kernel_code", { code: [
      "assert business_plugin_sentinel == 71039",
      `operations = __import__('json').loads(${JSON.stringify(JSON.stringify(group.tools))})`,
      "assert not any(tool['name'] in operations for tool in gateway.describe())",
      "for name, args in operations.items():",
      "    for invoke in (lambda: getattr(gateway, name)(**args), lambda: gateway.call(name, args)):",
      "        try: invoke()",
      "        except Exception as error: assert name + ' 在本会话已关闭' in str(error), str(error)",
      "        else: raise AssertionError(name + ' executed while disabled')",
      "print('BUSINESS_PLUGIN_DENIALS_71039')",
    ].join("\n") });
    assert.match(denied.text, /BUSINESS_PLUGIN_DENIALS_71039/u);
    await toggle(worker, group.id, true);
    await observe(group, true, false);
    await checkRestoredTools(fixture, worker, group.name, home);
    await toggle(worker, `lazy:${group.id}`, true);
    await observe(group, true, true);
    await checkRestoredTools(fixture, worker, group.name, home, true);
    await toggle(worker, `lazy:${group.id}`, false);
    const current = host.state(worker);
    assert.equal(current.streamId, retained.streamId, "Enable/lazy changes preserve the SDK host");
    assert.equal(current.sessionId, retained.sessionId);
    assert.equal(current.kernel?.kernelId, retained.kernel.kernelId, "Enable/lazy changes preserve the exact kernel");
    results.push({ plugin: group.name, tools: Object.keys(group.tools), independentSwitch: true, lazyCallable: true, denied: ["direct", "tool_call", "gateway.method", "gateway.call"] });
  }
  // Clear session lazy overrides, then apply deployment policy through the public global batch API.
  await action(worker, "capabilities", { changes: [...groups.map(({ id }) => ({ id: `lazy:${id}`, enabled: null })),
    ...["session_list", "skill_read"].map((name) => ({ id: `lazy:tool:${name}`, enabled: null })),
  ] });
  const changes = [
    { id: "lazy:tool:space_status", enabled: true },
    ...groups.filter(({ name }) => !["ask", "sessions"].includes(name)).map(({ id }) => ({ id: `lazy:${id}`, enabled: true })),
  ];
  await host.capabilitiesChange({ changes });
  const stored = structuredClone(parse(await readFile(join(home, "config.toml"), "utf8"))).session.capabilities;
  for (const { id, enabled } of changes) assert.equal(stored[id], enabled, "Deployment defaults belong in stored global config");
  const policy = (await run(worker)).request;
  for (const group of groups) for (const name of Object.keys(group.tools)) {
    assert.equal(policy.tools.some((tool) => tool.name === name), name === "ask", `${name} follows explicit B1 deployment policy`);
  }
  for (const name of ["session_spawn", "session_send", "session_result", "session_list", "session_manage"]) {
    assert(policy.tools.some((tool) => tool.name === name), "The space_status item default must not make its whole sessions group lazy");
  }
  await toggle(worker, "lazy:tool:space_status", false);
  assert((await run(worker)).request.tools.some(({ name }) => name === "space_status"), "A session item override beats the global space_status default");
  await toggle(worker, "lazy:tool:space_status", null);
  assert(!(await run(worker)).request.tools.some(({ name }) => name === "space_status"), "Reset restores the individual global default");
  await run(worker, "kernel_code", { code: "assert business_plugin_sentinel == 71039\nassert isinstance(gateway.space_status()['sessions'], list)" });
  assert.equal(host.state(worker).kernel.kernelId, retained.kernel.kernelId);
  return results;
}
