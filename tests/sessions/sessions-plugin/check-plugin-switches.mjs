import { parse } from "smol-toml";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertSessionSection } from "../prompt-sections/assert-session-section.mjs";

export async function checkPluginSwitches(fixture, { root, child, nested }, home) {
  const { host, run, action } = fixture;
  const tools = ["space_status", "session_spawn", "session_send", "session_result", "session_list", "session_manage"];
  const group = "group:tools:package:<inline:sessions>";
  const catalog = (name) => action(name, "capabilities");
  const assertPlugin = (inventory) => {
    assert(inventory.groups.some(({ id }) => id === group), "Public SDK toolOrigin must publish the sessions inline factory as its own plugin group");
    assert.equal(inventory.groups.find(({ id }) => id === group).name, "sessions");
    for (const name of tools) {
      const entry = inventory.entries.find(({ id }) => id === `tool:${name}`);
      assert(entry, `Stable tool:${name} capability ID must remain present`);
      assert.equal(entry.group, group, `${name} is a plugin tool, never a PRK custom tool`);
      assert.equal(entry.groupLabel, "sessions");
      assert.equal(entry.source, "sessions");
    }
  };
  // Check global discovery independently of the live session's catalog.
  assertPlugin((await host.capabilitiesList()).catalog);
  for (const name of [root, child, nested]) assertPlugin(await catalog(name));
  const globalDocument = structuredClone(parse(await readFile(join(home, "config.toml"), "utf8")));
  for (const tool of ["space_status", "session_list", "session_manage"]) {
    assert.equal(globalDocument.session.capabilities[`lazy:tool:${tool}`], true);
  }
  // Remove same-layer tool overrides through the public batch API before testing the group.
  await host.capabilitiesChange({ changes: [
    ...["space_status", "session_list", "session_manage"].map((tool) => ({ id: `lazy:tool:${tool}`, enabled: null })),
    { id: `lazy:${group}`, enabled: false },
  ] });
  const cleared = structuredClone(parse(await readFile(join(home, "config.toml"), "utf8")));
  for (const tool of tools) assert(!Object.hasOwn(cleared.session.capabilities, `lazy:tool:${tool}`));
  const assertDeclarations = (request, present) => {
    for (const tool of tools) assert.equal(request.tools.some(({ name }) => name === tool), present, `${tool} declaration follows the plugin switch/lazy`);
  };
  const section = (request) => /<sessions>\n([\s\S]*?)\n<\/sessions>/u.exec(request.instructions)?.[1];
  const allVisible = (await run(root)).request;
  assertDeclarations(allVisible, true);
  await run(root, "kernel_code", { code: "sessions_plugin_sentinel = 6127" });
  const before = new Map([root, child, nested].map((name) => [name, structuredClone(host.state(name))]));
  await host.capabilitiesChange({ changes: [{ id: group, enabled: false }] });
  for (const name of [root, child, nested]) {
    const request = (await run(name)).request;
    assertDeclarations(request, false);
    assert.equal(section(request), undefined, "A disabled plugin must omit <sessions>, including derived identity text");
    for (const tool of tools) assert.doesNotMatch(request.instructions, new RegExp(`^${tool}:`, "mu"), "Disabled tools must also leave the hidden catalog");
    const inventory = await catalog(name);
    assert.equal(inventory.requiresReload, false);
    for (const tool of tools) assert.equal(inventory.entries.find(({ id }) => id === `tool:${tool}`).enabled, false);
  }
  const operations = {
    space_status: {},
    session_spawn: { context: "This call must be rejected before admission.", tasks: [{ task: "Never create this child", label: "Forbidden child", target: "fixture" }] },
    session_send: { to: host.state(child).sessionId, message: "Never deliver this disabled message", expectReply: false },
    session_result: { summary: "Never submit this disabled result" },
    session_list: {},
    session_manage: { action: "destroy", child: host.state(nested).sessionId },
  };
  const workersBeforeDenials = host.workbench().sessions.map(({ sessionId }) => sessionId);
  for (const [tool, args] of Object.entries(operations)) {
    for (const [name, input] of [[tool, args], ["tool_call", { name: tool, args }]]) {
      const rejected = await run(root, name, input, true);
      assert.match(rejected.text, new RegExp(`${tool} 在本会话已关闭`, "u"), "Direct SDK and nested tool_call invocation must share the actual permission hook");
    }
  }
  const gatewayDenials = await run(root, "kernel_code", { code: [
    "assert sessions_plugin_sentinel == 6127",
    `operations = __import__('json').loads(${JSON.stringify(JSON.stringify(operations))})`,
    "assert not any(tool['name'] in operations for tool in gateway.describe())",
    "for name, args in operations.items():",
    "    for invoke in (lambda: getattr(gateway, name)(**args), lambda: gateway.call(name, args)):",
    "        try: invoke()",
    "        except Exception as error: assert name + ' 在本会话已关闭' in str(error), str(error)",
    "        else: raise AssertionError(name + ' executed while its plugin was disabled')",
    "print('SESSIONS_PLUGIN_GATEWAY_DENIALS_6127')",
  ].join("\n") });
  assert.match(gatewayDenials.text, /SESSIONS_PLUGIN_GATEWAY_DENIALS_6127/u);
  assert.deepEqual(host.workbench().sessions.map(({ sessionId }) => sessionId), workersBeforeDenials, "Rejected spawn/manage calls cannot create or destroy sessions");
  await host.capabilitiesChange({ changes: [{ id: group, enabled: true }] });
  for (const [name, depth, parentLabel] of [[root, 0], [child, 1, "Prompt Root"], [nested, 2, "Prompt Child"]]) {
    const restored = (await run(name)).request;
    assertDeclarations(restored, true);
    assertSessionSection(section(restored), { depth, parentLabel });
  }
  const callableAgain = await run(root, "session_list");
  assert(callableAgain.data.some(({ sessionId }) => sessionId === host.state(child).sessionId), "Re-enabling the plugin restores real execution without reload");
  await host.capabilitiesChange({ changes: [{ id: `lazy:${group}`, enabled: true }] });
  for (const name of [root, child, nested]) {
    const lazy = (await run(name)).request;
    assertDeclarations(lazy, false);
    assert(section(lazy), "Lazy affects declarations, not the callable sessions mechanism");
    const inventory = await catalog(name);
    for (const tool of tools) {
      assert.match(lazy.instructions, new RegExp(`^${tool}:`, "mu"), "Every lazy tool must appear in the hidden catalog");
      const entry = inventory.entries.find(({ id }) => id === `tool:${tool}`);
      assert.equal(entry.enabled, true);
      assert.equal(entry.lazy.enabled, true);
    }
  }
  assert((await run(root, "tool_call", { name: "session_list", args: {} })).data.some(({ sessionId }) => sessionId === host.state(child).sessionId), "A lazy tool remains executable via tool_call");
  await run(root, "kernel_code", { code: "assert sessions_plugin_sentinel == 6127\nassert isinstance(gateway.session_list(), list)" });
  for (const name of [root, child, nested]) {
    const current = host.state(name), original = before.get(name);
    assert.equal(current.streamId, original.streamId, "Plugin enable/lazy changes must preserve the exact SDK host");
    assert.equal(current.sessionId, original.sessionId);
    assert.equal(current.kernel?.kernelId, original.kernel?.kernelId, "Plugin switches must preserve the retained kernel");
  }
}
