import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function checkRemoteSwitchScenario(fixture, scenario) {
  const { host, sessionId: worker, action, toggle, run, text, generation, generations } = fixture;
  const name = "gateway_double";
  const reason = `${name} 在本会话已关闭`;
  await toggle(`tool:${name}`, true);
  await toggle(`lazy:tool:${name}`, scenario === "search" || scenario === "meta");
  await action("tool-mode", { mode: scenario === "kernel" ? "code" : "direct" });
  const retained = `remote-switch-${scenario}-${randomUUID()}`;
  const seeded = await run("kernel_code", { code: `import os\nremote_switch_kept = ${JSON.stringify(retained)}\nremote_switch_kernel_pid = os.getpid()\nprint("REMOTE_SWITCH_KERNEL_SEEDED")`, title: "Retain switch scenario state" });
  assert.equal(seeded.result.isError, false, text(seeded.result));
  const identity = await run("remote_probe", { action: "identity" });
  assert.equal(identity.result.isError, false, text(identity.result));
  if (scenario === "declarations" || scenario === "search") {
    const callable = await run("remote_probe", { action: "nested", value: 21 });
    assert.equal(callable.result.isError, false, text(callable.result));
    assert.deepEqual(callable.result.details.nested, { value: 42, pid: process.pid }, "The tool is genuinely callable before it is disabled");
  }
  const activeHost = generation();
  const hostPid = activeHost.registration.pid;
  assert.equal(identity.result.details.pid, hostPid, "Observe the actual target process through its plugin");
  assert.notEqual(hostPid, process.pid);
  const state = host.state(worker);
  const original = { sessionId: state.sessionId, streamId: state.streamId, kernelId: state.kernel.kernelId };
  assert(original.kernelId, "The scenario uses a real retained kernel");
  const route = () => {
    if (scenario === "declarations") return run();
    if (scenario === "search") return run("tool_search", { query: name });
    if (scenario === "kernel") return run("kernel_code", { code: "print(gateway.gateway_double(value=21))", title: "Real kernel nested switch path" });
    if (scenario === "meta") return run("tool_call", { name, args: { value: 21 } });
    return run("remote_probe", { action: "nested", value: 21 });
  };
  const assertEnabled = (observed) => {
    if (scenario === "declarations") {
      for (const request of observed.requests) {
        assert(request.tools.includes(name), "Enabled direct plugin tools are declared without lazy loading");
        assert(request.prompt.includes("SWITCH_REMOTE_DOUBLE_GUIDELINE_7319"));
      }
    } else {
      assert.equal(observed.result.isError, false, text(observed.result));
      if (scenario === "search") {
        assert.deepEqual(observed.execution.result.structuredContent.tools.map((tool) => tool.name), [name]);
        assert(observed.requests[0].prk.includes(name), "Lazy enabled tools remain discoverable in the PRK prompt");
      } else if (scenario === "remote") {
        assert.equal(observed.result.details.pid, hostPid);
        assert.deepEqual(observed.result.details.nested, { value: 42, pid: process.pid }, "The actual target plugin reverse-calls the Gateway tool");
      } else if (scenario === "meta") {
        assert.deepEqual(observed.result.details, { value: 42, pid: process.pid });
      } else assert.match(text(observed.result), /\b42\b/u);
    }
  };
  const enabled = await route();
  if (scenario === "declarations") assert(enabled.requests[0].tools.includes(name), "The direct tool is declared before the switch");
  else assertEnabled(enabled);
  await toggle(`tool:${name}`, false);
  const disabled = await route();
  if (scenario === "declarations") {
    for (const request of disabled.requests) {
      assert(!request.tools.includes(name), "The very next provider request hides a disabled direct declaration");
      assert(!request.declarations.includes(name));
      assert(!request.prompt.includes(name), "The disabled tool is absent from the effective system prompt");
      assert(!request.prompt.includes("SWITCH_REMOTE_DOUBLE_GUIDELINE_7319"), "Disabled tools contribute no guidelines");
      assert(!request.prk.includes(name), "The PRK capabilities section omits disabled tools");
    }
  } else if (scenario === "search") {
    assert.equal(disabled.result.isError, false, text(disabled.result));
    assert.deepEqual(disabled.execution.result.structuredContent.tools, [], "tool_search cannot find a disabled lazy tool");
    assert(!disabled.requests[0].prk.includes(name));
  } else {
    assert.equal(disabled.result.isError, true, "The real nested route must return a tool failure");
    assert(text(disabled.result).includes(reason), text(disabled.result));
    assert.equal(disabled.execution.isError, true, "Public outer completion agrees with the SDK transcript");
    const nested = disabled.executions.find((event) => event.toolName === name && event.parentToolCallId === disabled.result.toolCallId);
    assert(nested, "The real SDK emits the disabled nested tool completion with its actual parent call ID");
    assert.equal(nested.isError, true);
    assert(text(nested.result).includes(reason), text(nested.result));
    if (scenario === "remote" || scenario === "meta") {
      assert.deepEqual(disabled.result.content, nested.result.content, "The outer route propagates the actual nested failure rather than replacing it");
    }
  }
  const catalog = await action("capabilities");
  assert.equal(catalog.entries.find((entry) => entry.id === `tool:${name}`).enabled, false);
  assert.equal(catalog.entries.find((entry) => entry.id === `tool:${name}`).loaded, true, "Permission changes never unregister the tool");
  assert.equal(catalog.requiresReload, false, "Tool switches never require reload");
  await toggle(`tool:${name}`, true);
  assertEnabled(await route());
  const continued = await run("kernel_code", { code: `import os\nassert remote_switch_kept == ${JSON.stringify(retained)}\nassert os.getpid() == remote_switch_kernel_pid\nprint("REMOTE_SWITCH_KERNEL_RETAINED")`, title: "Verify retained switch state" });
  assert.equal(continued.result.isError, false, text(continued.result));
  assert.match(text(continued.result), /REMOTE_SWITCH_KERNEL_RETAINED/u);
  const after = host.state(worker);
  assert.equal(after.sessionId, original.sessionId);
  assert.equal(after.streamId, original.streamId, "No switch replaces the SDK generation");
  assert.equal(after.kernel.kernelId, original.kernelId, "No switch replaces the kernel");
  assert.equal(generation(), activeHost, "The target plugin keeps the same host generation object");
  assert.equal(generation().registration.pid, hostPid);
  assert.equal(generations.filter((entry) => entry.sessionId === worker && entry.host === activeHost && entry.package !== "Pi native tools").length, 1);
  assert.equal((await action("capabilities")).requiresReload, false);
  await toggle(`lazy:tool:${name}`, false);
  console.log(JSON.stringify({ proof: "remote-switch-layers", scenario, ...original, hostPid, hostGeneration: activeHost.generation,
    disabledResult: scenario === "declarations" ? disabled.requests[0].tools : text(disabled.result), kernelVariableRetained: retained }));
}
