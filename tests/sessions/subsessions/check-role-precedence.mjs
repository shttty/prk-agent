import assert from "node:assert/strict";
import { DEFAULT_DERIVATION_ROLES, DEFAULT_DERIVED_INSTRUCTIONS } from "../../../src/config/derivation/derivation-types.ts";

export async function checkRolePrecedence({ owner, repoRoot, baseCwd, tempRoot, client, host, call, spawn, get, firstRequest, entries, saveDerivation, text }) {
  const configured = (await client.request("derivationGet")).derivation;
  const roleChild = await spawn(owner, { label: "Role precedence", role: "reviewer" });
  assert.equal(get(roleChild).cwd, baseCwd, "Role isolated:false overrides global isolated:true");
  assert.notEqual(get(roleChild).derivation.isolated, true);
  assert.equal(get(roleChild).derivation.model, "subsession-check/role");
  assert.equal(get(roleChild).derivation.thinkingLevel, "medium");
  const role = firstRequest("Role precedence"), roleNames = role.tools.map(({ name }) => name);
  assert.deepEqual([role.model, role.thinkingLevel], ["role", "medium"], "Role settings reach the real provider request");
  assert(roleNames.includes("session_spawn") && roleNames.includes("kernel_code"), "Role direct mode overrides global code mode on the first real request");
  assert(role.prompt.includes("Role instructions:\nROLE_SUBSESSION_INSTRUCTIONS"));
  assert(!role.prompt.includes("GLOBAL_SUBSESSION_INSTRUCTIONS"));
  assert(!roleNames.includes("write") && !roleNames.includes("session_send"), "Role capability overrides hide both native and session declarations immediately");
  assert(!roleNames.includes("terminal_textsend") && !role.prompt.includes("<terminals>"), "A disabled role plugin group hides its tools and prompt section");
  const nativeEntries = (await entries(roleChild)).filter((entry) => entry.type === "custom" && entry.customType === "gateway-native-session-state" && Object.hasOwn(entry.data, "toolMode"));
  assert.equal(nativeEntries.length, 1, "Initial tool mode and role capabilities share one native SDK state entry");
  assert.equal(nativeEntries[0].data.toolMode, "direct");
  assert.deepEqual(nativeEntries[0].data.capabilities, configured.roles.reviewer.capabilities);
  await call(roleChild, "write", { path: "never-written.txt", content: "forbidden" }, /write.*(?:关闭|disabled)/u);
  await call(roleChild, "tool_call", { name: "write", args: { path: "never-written.txt", content: "forbidden" } }, /write.*(?:关闭|disabled)/u);
  await call(roleChild, "session_send", { to: get(owner).sessionId, message: "Never deliver this disabled role message", expectReply: false }, /session_send.*(?:关闭|disabled)/u);
  await call(roleChild, "terminal_textsend", { text: "printf never-executed" }, /terminal_textsend.*(?:关闭|disabled)/u);
  await call(roleChild, "kernel_code", { code: [
    "from pathlib import Path",
    "assert not Path('never-written.txt').exists()",
    "assert not {'write', 'session_send'}.intersection(item['name'] for item in gateway.describe())",
    "for name, args in [('write', {'path':'never-written.txt', 'content':'forbidden'}), ('session_send', {'to':" + JSON.stringify(get(owner).sessionId) + ", 'message':'forbidden', 'expectReply':False})]:",
    "    try: gateway.call(name, args)",
    "    except RuntimeError as error: assert name in str(error), str(error)",
    "    else: raise AssertionError(name + ' executed despite role capability')",
    "assert not Path('never-written.txt').exists()",
    "print('ROLE_CAPABILITIES_DENIED_IN_TARGET_KERNEL')",
  ].join("\n") });
  const explicit = await spawn(owner, { label: "Explicit model precedence", role: "reviewer", model: "subsession-check/explicit", thinkingLevel: "high" });
  assert.equal(get(explicit).derivation.model, "subsession-check/explicit");
  assert.equal(get(explicit).derivation.thinkingLevel, "high");
  assert.deepEqual([firstRequest("Explicit model precedence").model, firstRequest("Explicit model precedence").thinkingLevel], ["explicit", "high"]);
  const task = await spawn(owner, { label: "Task defaults" });
  assert.equal(get(task).derivation.role, "task", "Omitting role selects and persists the builtin task role");
  assert.equal(get(task).derivation.model, "subsession-check/task", "Task model applies to persistent children as well as temporary tasks");
  assert.equal(get(task).derivation.thinkingLevel, "low");
  assert.equal(get(task).derivation.isolated, true);
  assert.equal(get(task).derivation.repoRoot, repoRoot);
  const taskRequest = firstRequest("Task defaults"), taskNames = taskRequest.tools.map(({ name }) => name);
  assert.deepEqual([taskRequest.model, taskRequest.thinkingLevel], ["task", "low"]);
  assert(taskNames.includes("kernel_code") && !taskNames.includes("session_spawn") && !taskNames.includes("session_result"), "Global code mode changes actual child declarations");
  assert(taskRequest.prompt.includes("Role instructions:\nGLOBAL_SUBSESSION_INSTRUCTIONS"));
  const small = await spawn(owner, { label: "Builtin small inheritance", role: "small" });
  assert.equal(get(small).derivation.role, "small");
  assert.equal(get(small).derivation.model, "subsession-check/parent", "A selected small role never borrows task's model");
  assert.equal(get(small).derivation.thinkingLevel, "off");
  assert(firstRequest("Builtin small inheritance").tools.some(({ name }) => name === "session_spawn"), "Builtin small keeps its direct mode under a global code default");
  const silent = await spawn(owner, { label: "Empty role instructions", role: "silent", isolated: false });
  assert(!firstRequest("Empty role instructions").prompt.includes("Role instructions:"), "An explicit empty role instruction does not fall back to global text");
  assert.equal(get(silent).cwd, baseCwd, "Request isolated:false overrides global true");
  const discovery = await call(owner, "space_status", {});
  assert.deepEqual(discovery.derivationDefaults, { toolMode: "code", isolated: true, maxDepth: 2 });
  for (const name of Object.keys(DEFAULT_DERIVATION_ROLES)) {
    assert(discovery.roles.some((entry) => entry.name === name), `Builtin ${name} is discoverable`);
  }
  const published = discovery.roles.find(({ name }) => name === "reviewer");
  assert.equal(published.description, configured.roles.reviewer.description);
  assert.equal(published.toolMode, "direct");
  assert.equal(published.isolated, false);
  for (const child of [roleChild, explicit, task, small, silent]) await call(owner, "session_manage", { action: "destroy", child });
  await saveDerivation({ ...configured, roles: { ...configured.roles, task: { ...configured.roles.task,
    toolMode: "direct", isolated: false, instructions: "TASK_ROLE_INSTRUCTIONS", capabilities: { "tool:write": false } } } });
  const overridden = await spawn(owner, { label: "Omitted task behavior" });
  assert.equal(get(overridden).derivation.role, "task");
  assert.equal(get(overridden).cwd, baseCwd, "Omitted role applies task isolation rather than the global default");
  const overriddenRequest = firstRequest("Omitted task behavior");
  assert(overriddenRequest.tools.some(({ name }) => name === "session_spawn"), "Omitted role applies task tool mode");
  assert(!overriddenRequest.tools.some(({ name }) => name === "write"), "Omitted role applies task capabilities on the first request");
  assert(overriddenRequest.prompt.includes("Role instructions:\nTASK_ROLE_INSTRUCTIONS"));
  assert(!overriddenRequest.prompt.includes("GLOBAL_SUBSESSION_INSTRUCTIONS"));
  await call(overridden, "write", { path: "never-task-written.txt", content: "forbidden" }, /write.*(?:关闭|disabled)/u);
  await call(owner, "session_manage", { action: "destroy", child: overridden });
  await saveDerivation({});
  for (const [action, args] of [["model", { model: "subsession-check/explicit" }], ["thinking", { level: "high" }], ["tool-mode", { mode: "code" }]]) {
    assert.equal((await host.nativeAction(owner, { sessionId: owner, requestId: `parent-current-${action}`, action, args })).status, "completed");
  }
  const fallback = await spawn(owner, { label: "Configured session fallback" });
  assert.equal(get(fallback).derivation.role, "task");
  assert.equal(get(fallback).derivation.model, "subsession-check/explicit", "An unconfigured task inherits the parent's current model, not its startup model");
  assert.equal(get(fallback).derivation.thinkingLevel, "high", "An unconfigured task inherits the parent's current thinking level");
  assert.deepEqual([firstRequest("Configured session fallback").model, firstRequest("Configured session fallback").thinkingLevel], ["explicit", "high"]);
  assert.equal((await client.request("nativeCapabilities", { sessionId: get(fallback).sessionId })).target.current.toolMode, "direct", "Fallback is the configured session mode, not the parent's current code mode");
  assert(firstRequest("Configured session fallback").prompt.includes(`Role instructions:\n${DEFAULT_DERIVED_INSTRUCTIONS}`));
  await call(owner, "session_manage", { action: "destroy", child: fallback });
  for (const [role, expectedModel, expectedThinking, label] of [
    [{ model: "subsession-check/task" }, "subsession-check/task", "high", "Task model only"],
    [{ thinkingLevel: "medium" }, "subsession-check/explicit", "medium", "Task thinking only"],
  ]) {
    await saveDerivation({ roles: { task: role } });
    const child = await spawn(owner, { label });
    assert.equal(get(child).derivation.model, expectedModel, "Model selection is field-by-field");
    assert.equal(get(child).derivation.thinkingLevel, expectedThinking, "Thinking selection is field-by-field");
    assert.deepEqual([firstRequest(label).model, firstRequest(label).thinkingLevel], [expectedModel.split("/")[1], expectedThinking]);
    await call(owner, "session_manage", { action: "destroy", child });
  }
  for (const [action, args] of [["model", { model: "subsession-check/parent" }], ["thinking", { level: "off" }], ["tool-mode", { mode: "direct" }]]) {
    assert.equal((await host.nativeAction(owner, { sessionId: owner, requestId: `parent-restore-${action}`, action, args })).status, "completed");
  }
  await saveDerivation({ maxDepth: 1 });
  const depthOne = await spawn(owner, { label: "Maximum depth one" });
  const before = host.workbench().sessions.map(({ sessionId }) => sessionId).sort();
  await call(depthOne, "session_spawn", { context: "Reject children past configured maximum depth.", tasks: [{ label: "Excess depth", task: "Never create a depth-two child" }] }, /Maximum derivation depth/iu);
  await call(owner, "session_spawn", { context: "Reject unavailable selections before child admission.", tasks: [{ label: "Unknown selected role", task: "Never create this child", role: "missing" }] }, /role/i);
  await call(owner, "session_spawn", { context: "Reject unavailable selections before child admission.", tasks: [{ label: "Unknown selected model", task: "Never create this child", model: "subsession-check/missing" }] }, /model/i);
  for (const task of [{ task: "Missing label" }, { task: "Empty label", label: "" }, { task: "Whitespace label", label: " " }, { task: "Removed tool mode", label: "Removed mode", toolMode: "direct" }]) {
    const denied = await call(owner, "session_spawn", { context: "Reject invalid task schemas before child admission.", tasks: [task] }, true);
    assert.match(text(denied), /label|toolMode|parameter|property|schema|additional/iu);
  }
  assert.deepEqual(host.workbench().sessions.map(({ sessionId }) => sessionId).sort(), before, "Depth and schema failures create no child identity");
  await call(owner, "session_manage", { action: "destroy", child: depthOne });
  await saveDerivation({ defaultIsolated: true });
  await call(owner, "session_spawn", { context: "Isolation needs a real repository.", tasks: [{ label: "Non-git isolation", task: "Never isolate a non-git directory", cwd: tempRoot }] }, /git.*isolated: false/iu);
  const optOut = await spawn(owner, { label: "Non-git explicit opt-out", cwd: tempRoot, isolated: false });
  assert.equal(get(optOut).cwd, tempRoot, "Explicit opt-out keeps non-git projects usable under a global isolation default");
  await call(owner, "session_manage", { action: "destroy", child: optOut });
  await saveDerivation({});
}
