import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function assembleFixture({ home, agentDir, config, onCleanup }) {
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools, getCurrentSystemMessage, getSystemMessageText } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../../src/gateway/host/start-host.ts");
  const { prepareGatewayEnvironment } = await import("../prepare-gateway-environment.mjs");
  const { startGateway } = await import("../../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../../src/gateway/socket-client/connect-client.ts");
  const { parsePrkConfig } = await import("../../../src/config/document/parse-prk-config.ts");
  const cwd = join(home, "project");
  const plugin = join(home, "fixture-plugin");
  await Promise.all([mkdir(cwd), mkdir(plugin), mkdir(agentDir, { recursive: true })]);
  await writeFile(join(plugin, "package.json"), JSON.stringify({ name: "prk-tool-search-fixture", pi: { extensions: ["register.mjs"] } }));
  await writeFile(join(plugin, "register.mjs"), `export { default } from ${JSON.stringify(new URL("./register-probes.mjs", import.meta.url).href)};\n`);
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source: plugin, enabled: true, location: "gateway" }], compaction: { enabled: false }, retry: { enabled: false } }));
  const document = { session: { noExtensions: false, workerTools: "direct", idleTimeoutMs: 60000, capabilities: {
    "lazy:tool:session_list": true, "lazy:tool:session_manage": true,
    "lazy:tool:space_status": true,
    ...Object.fromEntries(["skill-tools", "memory", "plugin-config", "terminals", "tool-library"].map((name) => [`lazy:group:tools:package:<inline:${name}>`, true])),
    "lazy:tool:search_lazy": true, "lazy:tool:search_description": true,
    "lazy:tool:search_model_only": true, "lazy:tool:search_disabled": true, "tool:search_disabled": false,
  } }, memory: { review: false } };
  const instances = [{ id: "fixture", label: "Tool search fixture", local: true, tags: [],
    python: config.python, cwd }];
  await writeFile(join(home, "config.toml"), stringify(document));
  await writeFile(join(home, "instances.toml"), stringify({ instances }), { mode: 0o600 });
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "tool-search-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const host = await createGatewayHost({ home, cwd, config: parsePrkConfig(document, { instances }), model: "tool-search-check/controlled" }, {
    runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd, agentDir },
  });
  let endpoint, client;
  onCleanup(async () => {
    try { await client?.disconnect(); }
    finally { if (endpoint) await endpoint.close(); else await host.close(); }
  });
  endpoint = await startGateway(host, join(home, "gateway.sock"));
  client = await connectGateway(join(home, "gateway.sock"));
  await prepareGatewayEnvironment(host, home, "fixture");
  const worker = (await client.request("createSession", { target: "fixture" })).session.sessionId;
  const requests = [];
  const text = (message) => message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const action = async (name, args, selected = worker) => {
    const reply = await client.request("nativeAction", { sessionId: selected, requestId: crypto.randomUUID(), action: name, ...(args === undefined ? {} : { args }) });
    assert.equal(reply.status, "completed", JSON.stringify(reply));
    return reply.data;
  };
  const catalog = (selected = worker) => action("capabilities", undefined, selected);
  const toggle = (id, enabled, selected = worker) => action("capabilities", { changes: [{ id, enabled }] }, selected);
  const capture = (context) => {
    const tools = getCurrentTools(context.messages);
    const request = { declarations: JSON.stringify(tools), tools: tools.map(({ name }) => name).sort(),
      prompt: getSystemMessageText(getCurrentSystemMessage(context.messages)) };
    requests.push(request);
    return request;
  };
  const run = async (name, args = {}, selected = worker, beforeReply) => {
    const offset = requests.length;
    let toolCallId;
    provider.setResponses(name ? [
      (context) => {
        capture(context);
        const call = fauxToolCall(name, args);
        toolCallId = call.id;
        return fauxAssistantMessage(call, { stopReason: "toolUse" });
      },
      async (context) => { capture(context); await beforeReply?.({ toolCallId, completedTools }); return fauxAssistantMessage("Tool search observation complete."); },
    ] : [(context) => { capture(context); return fauxAssistantMessage("Tool search request observed."); }]);
    let timer, execution;
    const completedTools = [];
    const subscription = host.session(selected).subscribe((event) => {
      if (event.type !== "session_event" || event.details?.sdkType !== "tool_execution_end") return;
      const { toolName, toolCallId: completedId, parentToolCallId } = event.details;
      completedTools.push({ toolName, toolCallId: completedId, parentToolCallId });
      if (completedId === toolCallId) execution = event.details;
    });
    try {
      const accepted = await host.session(selected).submit({ requestId: crypto.randomUUID(), message: "Exercise the tool search acceptance fixture." });
      assert.equal(accepted.accepted, true);
      const completed = await Promise.race([accepted.completion, new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Tool search request did not settle")), 30000);
      })]);
      assert.equal(completed.status, "completed", JSON.stringify(completed));
      const result = name ? host.state(selected).messages.findLast((message) => message.role === "toolResult" && message.toolCallId === toolCallId) : undefined;
      if (name) {
        assert(result, `Missing real SDK transcript result for ${name}/${toolCallId}`);
        assert(execution, `Missing public completion for ${name}/${toolCallId}; observed ${JSON.stringify(completedTools)}`);
        assert.equal(execution.toolName, name);
        assert.equal(execution.isError, result.isError, "Public execution and transcript agree on failure");
        assert.deepEqual(execution.result.content, result.content, "Model-visible transcript content matches the actual execution");
        assert.deepEqual(execution.result.details, result.details);
      }
      return { requests: requests.slice(offset), result, execution };
    } finally { clearTimeout(timer); subscription.unsubscribe(); }
  };
  const events = async () => {
    try { return (await readFile(join(cwd, "tool-search-events.jsonl"), "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
  };
  return { home, host, client, sessionId: worker, requests, text, action, catalog, toggle, run, events };
}
