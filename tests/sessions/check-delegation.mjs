import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "prk-delegation-"));
  let host;
  const release = Promise.withResolvers();
  onCleanup(async () => { release.resolve(); await host?.close(); await rm(root, { recursive: true, force: true }); });
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "delegation-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const requests = [];
  const entered = Promise.withResolvers();
  provider.setResponses(Array.from({ length: 40 }, () => async (context) => {
    const tools = getCurrentTools(context.messages);
    requests.push({ prompt: getCurrentSystemPrompt(context.messages), tools, names: tools.map(({ name }) => name) });
    const last = context.messages.at(-1);
    const text = typeof last?.content === "string" ? last.content : last?.content?.filter(({ type }) => type === "text").map(({ text }) => text).join("\n");
    if (text === "BUSY") {
      entered.resolve();
      await release.promise;
      return fauxAssistantMessage(fauxToolCall("tool_search", { query: "space_status" }), { stopReason: "toolUse" });
    }
    return fauxAssistantMessage("Observed current policy.");
  }));
  const options = { cwd: root, home: root, historyDir: join(root, "history"), model: "delegation-check/controlled",
    targets: [executionTargetFromConfig({ ...config, id: "local", label: "local", local: true, cwd: root })] };
  const dependencies = { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir: root } };
  const configuration = (delegation) => parsePrkConfig({ session: { workerTools: "direct", delegation, idleTimeoutMs: 600000 }, memory: { review: false } });
  const defaults = configuration("eager");
  host = await createGatewayHost({ ...options, config: defaults }, dependencies);
  const a = (await host.createSession({ target: "local" })).session.sessionId;
  const b = (await host.createSession({ target: "local" })).session.sessionId;
  let sequence = 0;
  const current = (name) => host.nativeCapabilities(name).target.current;
  const action = (name, action, args) => host.nativeAction(name, { sessionId: name, requestId: `setting-${++sequence}`, action, args });
  async function run(name, message = "POLICY") {
    const accepted = await host.session(name).submit({ requestId: `turn-${++sequence}`, message });
    assert.equal(accepted.accepted, true);
    assert.equal((await accepted.completion).status, "completed");
    return requests.at(-1);
  }
  assert.equal(current(a).delegation, "eager");
  assert.equal(current(b).delegation, "eager");
  assert(host.nativeCapabilities(a).actions.some(({ name, enabled }) => name === "delegation" && enabled));
  for (const args of [undefined, {}, { level: "unknown" }, { level: null }, { level: "gated", mode: "direct" }]) {
    assert.equal((await action(a, "delegation", args)).status, "failed");
    assert.equal(current(a).delegation, "eager");
  }
  for (const mode of ["code", "direct"]) {
    assert.equal((await action(a, "tool-mode", { mode })).status, "completed");
    for (const level of ["gated", "restrained", "eager"]) {
      const changed = await action(a, "delegation", { level });
      assert.equal(changed.status, "completed");
      assert.deepEqual(changed.data, { delegation: level });
      assert.equal(current(a).delegation, level);
      assert.equal(current(b).delegation, "eager", "The sibling's policy is unchanged");
      assert.equal(defaults.session.delegation, "eager", "The global default is unchanged");
      assert.equal(current(a).requiresReload, false);
      const request = await run(a);
      assert.match(request.prompt, new RegExp(`Delegation policy: ${level}\\.`));
      assert.equal(request.names.includes("session_spawn"), mode === "direct");
      if (mode === "code") assert.match(request.prompt, /^session_spawn: .+/m);
      else assert(request.tools.find(({ name }) => name === "session_spawn").parameters.required.includes("tasks"), "Direct mode declares the callable batch-spawn schema");
      assert.doesNotMatch(request.prompt, /gateway\.wait/);
    }
  }
  await action(a, "delegation", { level: "gated" });
  const busy = await host.session(a).submit({ requestId: "busy-policy", message: "BUSY" });
  const timer = setTimeout(() => entered.reject(new Error("Provider did not reach busy turn")), 20000);
  try { await entered.promise; } finally { clearTimeout(timer); }
  assert.match(requests.at(-1).prompt, /Delegation policy: gated\./);
  assert.equal((await action(a, "delegation", { level: "restrained" })).status, "completed", "A running session accepts policy changes");
  release.resolve();
  assert.equal((await busy.completion).status, "completed");
  assert.match(requests.at(-1).prompt, /Delegation policy: restrained\./, "The next provider request in the same run sees the changed policy");
  await run(b);
  const requestCount = requests.length;
  await host.close();
  host = await createGatewayHost({ ...options, config: configuration("gated") }, dependencies);
  assert.equal(host.nativeCapabilities(a).target.state, "sleeping");
  assert.equal(current(a).delegation, "restrained", "Dormant catalog reads persisted session state");
  const stored = (await SessionManager.list(root, options.historyDir)).find(({ id }) => id === host.nativeCapabilities(a).target.sessionId);
  assert(stored);
  assert(SessionManager.open(stored.path).getEntries().some((entry) => entry.type === "custom" && entry.customType === "gateway-native-session-state" && entry.data.delegation === "restrained"));
  assert.equal(current(b).delegation, "eager", "Initial policy persists despite changed global default");
  assert.equal(requests.length, requestCount, "Dormant inspection does not call a model");
  const c = (await host.createSession({ target: "local" })).session.sessionId;
  assert.equal(current(c).delegation, "gated", "Only new sessions receive the changed global default");
  await host.wakeSession(a);
  assert.equal(current(a).delegation, "restrained");
  assert.match((await run(a)).prompt, /Delegation policy: restrained\./);
});
console.log("Session delegation live policy and persistence checks passed.");
