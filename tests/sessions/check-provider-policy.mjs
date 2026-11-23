import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

const home = await mkdtemp(join(tmpdir(), "prk-policy-test-"));
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir, { recursive: true });
// SDK resolves its global home at import time; isolate it before module evaluation.
const { DefaultResourceLoader, SettingsManager, ModelRuntime, SessionManager, createAgentSessionServices, createAgentSessionFromServices } = await import("@earendil-works/pi-coding-agent");
const { fauxProvider, fauxAssistantMessage } = await import("@earendil-works/pi-ai");
const definition = { baseUrl: "http://127.0.0.1:1", api: "openai-responses", apiKey: "fixture-key", models: [{ id: "plugin-model", name: "Plugin model", contextWindow: 4096, maxTokens: 128, input: ["text"], reasoning: false, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] };
const tool = { name: "policy_tool", description: "Policy survivor", label: "Policy survivor", parameters: { type: "object", properties: {} }, execute: async () => ({ content: [{ type: "text", text: "survived" }] }) };
const options = (extra) => ({ cwd: home, agentDir, settingsManager: SettingsManager.inMemory({ defaultProjectTrust: "always" }), noExtensions: true, noSkills: true, noThemes: true, noContextFiles: true, noPromptTemplates: true, ...extra });
try {
  const streamProvider = fauxProvider({ provider: "owned-stream", models: [{ id: "controlled" }] });
  const requests = [];
  let api;
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  runtime.registerNativeProvider(streamProvider.provider);
  const before = runtime.getModels().map(({ provider, id }) => `${provider}/${id}`);
  const resources = options({
    providerPolicy(request) { requests.push(request); return request.providerId === "owned-stream" ? false : `Rejected ${request.providerId}`; },
    extensionFactories: [(pi) => {
      api = pi;
      pi.registerProvider("unowned-load", definition);
      pi.registerProvider(fauxProvider({ provider: "unowned-native", models: [{ id: "native" }] }).provider);
      pi.unregisterProvider("unowned-remove");
      pi.registerProvider("owned-stream", definition);
      pi.unregisterProvider("owned-stream");
      pi.registerTool(tool);
      pi.registerCommand("policy_command", { handler: async () => {} });
      pi.on("session_start", () => {});
    }],
  });
  const services = await createAgentSessionServices({ cwd: home, agentDir, modelRuntime: runtime, settingsManager: resources.settingsManager, resourceLoaderOptions: resources });
  const result = services.resourceLoader.getExtensions();
  assert.deepEqual(result.errors.map(({ code, providerId, operation }) => ({ code, providerId, operation })), [
    { code: "PROVIDER_POLICY", providerId: "unowned-load", operation: "register" },
    { code: "PROVIDER_POLICY", providerId: "unowned-native", operation: "register" },
    { code: "PROVIDER_POLICY", providerId: "unowned-remove", operation: "unregister" },
  ]);
  assert.equal(result.extensions[0].tools.has("policy_tool"), true);
  assert.equal(result.extensions[0].commands.has("policy_command"), true);
  assert.equal(result.extensions[0].handlers.has("session_start"), true);
  assert.deepEqual(runtime.getModels().map(({ provider, id }) => `${provider}/${id}`), before);
  assert.ok(requests.every(({ source, extensionPath }) => source === extensionPath));
  const { session } = await createAgentSessionFromServices({ services, model: streamProvider.getModel(), sessionManager: SessionManager.inMemory(home), tools: ["policy_tool"] });
  try {
    const liveErrors = [];
    await session.bindExtensions({ onError: (error) => liveErrors.push(error) });
    api.registerProvider("unowned-live", definition);
    api.unregisterProvider("unowned-live");
    assert.equal(liveErrors.length, 2);
    assert.ok(liveErrors.every(({ event }) => event === "provider_policy"));
    assert.equal(services.resourceLoader.getExtensions().errors.length, 5);
    assert.deepEqual(runtime.getModels().map(({ provider, id }) => `${provider}/${id}`), before);
    streamProvider.setResponses([fauxAssistantMessage("Existing model streaming still works.")]);
    const response = await session.modelRuntime.completeSimple(streamProvider.getModel(), { messages: [] });
    assert.equal(response.content.filter(({ type }) => type === "text").map(({ text }) => text).join(""), "Existing model streaming still works.");
  } finally { session.dispose(); }
  console.log("PASS provider policy: both overloads, unregister, post-bind errors, retained tools/hooks/commands, existing model streaming");

  const first = join(home, "ordinary");
  const second = join(home, "provider");
  await mkdir(first); await mkdir(second);
  const signal = `policy-${crypto.randomUUID()}`;
  await writeFile(join(first, "package.json"), JSON.stringify({ name: "ordinary-fixture", pi: { extensions: ["index.ts"] } }));
  await writeFile(join(first, "index.ts"), `export default (pi) => { pi.registerTool(${JSON.stringify({ ...tool, execute: undefined })}); pi.registerCommand("ordinary", {handler: async()=>{}}); pi.registerFlag("ordinary", {type:"boolean",default:true}); pi.events.on(${JSON.stringify(signal)}, () => { throw Error("Discarded subscriber executed"); }); };`);
  await writeFile(join(second, "package.json"), JSON.stringify({ name: "provider-fixture", pi: { extensions: ["index.ts"] } }));
  await writeFile(join(second, "index.ts"), `export default (pi) => { pi.registerProvider("provider-fixture", ${JSON.stringify(definition)}); pi.registerCommand("provider-command", {handler: async()=>{}}); pi.events.emit(${JSON.stringify(signal)}, {}); };`);
  const settings = SettingsManager.inMemory({ packages: [first, second] });
  const sources = [];
  const bootstrap = new DefaultResourceLoader(options({ noExtensions: false, settingsManager: settings, providerOnly: true, providerPolicy(request) { sources.push(request.source); return true; } }));
  await bootstrap.reload();
  const loaded = bootstrap.getExtensions();
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.extensions.length, 1);
  assert.equal(loaded.extensions[0].commands.has("provider-command"), true);
  assert.equal(loaded.runtime.flagValues.has("ordinary"), false);
  assert.deepEqual(sources, [second]);
  assert.equal(loaded.runtime.pendingProviderRegistrations[0].name, "provider-fixture");
  loaded.runtime.invalidate();
  console.log("PASS provider-only bootstrap: real package sources/order, discarded tools/commands/flags/event subscriptions");
} finally { await rm(home, { recursive: true, force: true }); }
