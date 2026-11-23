import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { kernelPrelude } from "../../../src/codemode/kernel-prelude/build-prelude.ts";
import { createTarget } from "../fixtures/create-target.mjs";
import { parseProcessWindowLimits } from "../../../src/target-environment/process-window/parse-limits.ts";

export async function checkCapabilityInput({ config, home, onCleanup }) {
  const agentDir = join(home, "permission-agent");
  await mkdir(agentDir);
  const disabled = new Set();
  const owner = createPythonTool(config, {
    codeMode: true,
    prelude: () => kernelPrelude({ moduleHome: join(home, "permission-modules") }),
    kernelCapabilities: (name) => !disabled.has(name),
    allowGatewayTool: (name) => name !== "switch_capability",
  });
  let pendingSignal, finishLate;
  const pending = Promise.withResolvers();
  const callbacks = [{
    name: "switch_capability", label: "Switch kernel capability", description: "Controlled live permission input", exposure: "codemode",
    parameters: Type.Object({ name: Type.String(), enabled: Type.Boolean() }),
    async execute(_id, { name, enabled }) {
      if (enabled) disabled.delete(name); else disabled.add(name);
      return { content: [{ type: "text", text: "updated" }], details: undefined };
    },
  }, {
    name: "capability_late", label: "Wait for cancel", description: "Controlled late SDK result", exposure: "codemode", parameters: Type.Object({}),
    async execute(_id, _args, signal) {
      pendingSignal = signal;
      pending.resolve();
      return new Promise((resolve) => { finishLate = () => resolve({ content: [{ type: "text", text: "late capability result" }], details: undefined }); });
    },
  }];
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: `permission-${randomUUID()}`, models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" });
  const resourceLoader = new DefaultResourceLoader({ cwd: home, agentDir, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true });
  await resourceLoader.reload();
  const { session } = await createAgentSession({ cwd: home, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off", resourceLoader, settingsManager, sessionManager: SessionManager.inMemory(home), tools: [owner.tool.name, ...callbacks.map(({ name }) => name)], customTools: [owner.tool, ...callbacks] });
  onCleanup(async () => { await session.abort(); session.dispose(); await owner.close(); });
  const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const run = async (code, isError = false) => {
    provider.setResponses([fauxAssistantMessage(fauxToolCall("kernel_code", { code }), { stopReason: "toolUse" }), fauxAssistantMessage("Permission cell observed.")]);
    await session.prompt("Execute the real capability input cell.");
    const result = session.messages.findLast((message) => message.role === "toolResult" && message.toolName === "kernel_code");
    assert.equal(result.isError, isError, text(result));
    return result;
  };
  const result = await run(`import json
retained_permission_value = 42
retained_ls = ls
assert 'switch_capability' not in {tool['name'] for tool in gateway.describe()}
assert isinstance(retained_ls(), dict)
gateway.switch_capability(name='ls', enabled=False)
try:
    retained_ls()
except RuntimeError as error:
    assert '"ls"' in str(error) and 'disabled for this session' in str(error), str(error)
else:
    raise AssertionError('same-cell disabled alias executed')
gateway.switch_capability(name='ls', enabled=True)
assert isinstance(retained_ls(), dict)
invalid_payloads = ['{', '[]', '{}', '{"name":true}', '{"name":""}', json.dumps({'name':'x'*257}), json.dumps({'name':'ls', 'extra':True}), json.dumps({'name':'not_a_kernel_function'}), json.dumps({'name':'界'*2048})]
for payload in invalid_payloads:
    try:
        value = json.loads(payload)
    except json.JSONDecodeError:
        value = payload
    try:
        _prk_runtime.callback('capability', value)
        raise AssertionError('invalid capability payload accepted')
    except RuntimeError as error:
        assert str(error)
assert _prk_runtime.callback('capability', {'name':'ls'}) is None
print('CAPABILITY_INPUT_OK')`);
  assert.match(text(result), /CAPABILITY_INPUT_OK/);
  assert.equal(result.details.callbacks.filter((callback) => callback.name === "switch_capability" && callback.status === "ok").length, 2, "Ordinary Gateway calls must use SDK execution even when hidden from describe");
  const kernelId = owner.getSnapshot().kernelId;
  const running = run("retained_permission_value = 43\ngateway.capability_late()\nretained_permission_value = -1", true);
  await pending.promise;
  await session.abort();
  await running;
  assert.equal(pendingSignal.aborted, true);
  finishLate();
  const next = await run("assert retained_permission_value == 43\nassert isinstance(retained_ls(), dict)\nprint('CAPABILITY_CANCEL_REUSE_OK')");
  assert.match(text(next), /CAPABILITY_CANCEL_REUSE_OK/);
  assert(!text(next).includes("late capability result"));
  assert.equal(owner.getSnapshot().kernelId, kernelId);
  await owner.close();
}

if (import.meta.main) {
  const target = await createTarget(process.argv[2] ?? "local"), cleanups = [];
  try {
    await checkCapabilityInput({ config: { target: "owned", python: target.python, cwd: target.root, acquire: target.acquire, processWindow: parseProcessWindowLimits(), memoryMax: "4G", memorySwapMax: "0", scoped: false }, home: target.home, onCleanup: (cleanup) => cleanups.push(cleanup) });
    console.log(JSON.stringify({ status: "PASS", mode: process.argv[2] ?? "local", capabilityProtocol: true }));
  } finally { for (const cleanup of cleanups.reverse()) await cleanup(); await target.close(); }
}
