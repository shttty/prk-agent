import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function assembleRemoteSwitchFixture({ root, home, agentDir, config, onCleanup }) {
  const { prepareRemoteExtensionStore } = await import("../remote-extension-store.mjs");
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools, getCurrentSystemMessage, getSystemMessageText } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../../src/gateway/host/start-host.ts");
  const { prepareGatewayEnvironment } = await import("../prepare-gateway-environment.mjs");
  const { startGateway } = await import("../../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../../src/gateway/socket-client/connect-client.ts");
  const { parsePrkConfig } = await import("../../../src/config/document/parse-prk-config.ts");
  const { packages, bundlePaths } = await prepareRemoteExtensionStore(home, ["capabilities"]);
  const source = join(bundlePaths.capabilities, "node_modules", packages.capabilities.name);
  const cwd = join(root, "workspace");
  await mkdir(cwd);
  await mkdir(join(agentDir, "extensions"), { recursive: true });
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source, enabled: true, location: "host" }], compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" }));
  await writeFile(join(agentDir, "extensions", "gateway-double.js"), `export default function(pi) {
    pi.registerTool({ name: "gateway_double", label: "Gateway double", description: "Local reverse-call switch acceptance",
      promptSnippet: "Double a number on the Gateway", promptGuidelines: ["SWITCH_REMOTE_DOUBLE_GUIDELINE_7319"],
      parameters: { type: "object", properties: { value: { type: "number" } }, required: ["value"] },
      async execute(_id, { value }) {
        return { content: [{ type: "text", text: String(value * 2) }], details: { value: value * 2, pid: process.pid } };
      } });
  }\n`);
  const document = { monitor: { enabled: false }, targetConnection: { startTimeoutMs: 15000 }, memory: { review: false },
    remoteHost: { runtime: process.env.PI_TEST_REMOTE_HOST_RUNTIME ?? "bun" },
    session: { noExtensions: false, bootstrapNoSkills: true, localTools: false, workerTools: "direct", idleTimeoutMs: 600000,
      capabilities: { "lazy:tool:gateway_double": false, "lazy:tool:remote_probe": false } } };
  const instances = { instances: [{ id: "switch-remote", label: "Owned remote switch fixture", local: false, tags: [],
    python: config.python, sshCommand: "exec /bin/sh", cwd }] };
  await writeFile(join(home, "config.toml"), stringify(document));
  await writeFile(join(home, "instances.toml"), stringify(instances), { mode: 0o600 });
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "switch-remote-controlled", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const generations = [];
  const host = await createGatewayHost({ cwd, home, noSkills: true, historyDir: join(home, "history"),
    model: "switch-remote-controlled/controlled", thinkingLevel: "off", config: parsePrkConfig(document, instances) }, {
    runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd, agentDir },
    onRemoteExtensionGeneration(generation, context) { generations.push({ ...context, host: generation }); },
  });
  let endpoint, client;
  onCleanup(async () => {
    try { client?.disconnect(); }
    finally { if (endpoint) await endpoint.close(); else await host.close(); }
  });
  endpoint = await startGateway(host, join(root, "gateway.sock"));
  client = await connectGateway(join(root, "gateway.sock"));
  await prepareGatewayEnvironment(host, home, "switch-remote");
  const worker = (await client.request("createSession", { target: "switch-remote" })).session.sessionId;
  const generation = () => generations.findLast((entry) => entry.sessionId === worker && entry.package === source)?.host;
  assert(generation()?.registration, "The real target capabilities plugin must be loaded");
  assert.notEqual(generation().registration.pid, process.pid);
  const text = (message) => (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const action = async (name, args) => {
    const reply = await client.request("nativeAction", { sessionId: worker, requestId: randomUUID(), action: name, ...(args === undefined ? {} : { args }) });
    assert.equal(reply.status, "completed", JSON.stringify(reply));
    return reply.data;
  };
  const toggle = (id, enabled) => action("capabilities", { changes: [{ id, enabled }] });
  const run = async (name, args = {}) => {
    const toolCallId = randomUUID();
    const requests = [];
    const executions = [];
    const capture = (context) => {
      const tools = getCurrentTools(context.messages);
      const prompt = getSystemMessageText(getCurrentSystemMessage(context.messages));
      const prk = /<tool_catalog>([\s\S]*?)<\/tool_catalog>/u.exec(prompt)?.[1] ?? "";
      requests.push({ tools: tools.map((tool) => tool.name), declarations: JSON.stringify(tools), prompt, prk });
    };
    provider.setResponses(name ? [
      (context) => { capture(context); return fauxAssistantMessage(fauxToolCall(name, args, { id: toolCallId }), { stopReason: "toolUse" }); },
      (context) => { capture(context); return fauxAssistantMessage("Observed real remote switch outcome."); },
    ] : [(context) => { capture(context); return fauxAssistantMessage("Observed real remote switch declarations."); }]);
    const subscription = host.session(worker).subscribe((event) => {
      if (event.type === "session_event" && event.details?.sdkType === "tool_execution_end") executions.push(event.details);
    });
    try {
      const admission = await host.nativeSend(worker, { sessionId: worker, requestId: randomUUID(), message: "Exercise remote capability switch", mode: "plain" });
      assert.equal(admission.accepted, true, JSON.stringify(admission));
      const completion = await admission.completion;
      assert.equal(completion.status, "completed", JSON.stringify(completion));
      const result = name ? host.state(worker).messages.findLast((message) => message.role === "toolResult" && message.toolCallId === toolCallId) : undefined;
      if (name) assert(result, `The real SDK transcript must contain ${name}/${toolCallId}`);
      return { requests, result, executions, execution: executions.find((event) => event.toolCallId === toolCallId) };
    } finally {
      subscription.unsubscribe();
    }
  };
  return { host, client, sessionId: worker, action, toggle, run, text, generation, generations };
}
