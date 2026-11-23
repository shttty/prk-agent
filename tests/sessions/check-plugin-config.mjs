import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
// plugin_config end to end: a faux model (direct mode) calls tool_call(plugin_config.set) → semantics land under the PRK home →
// the operator HTTP API reads them back with secrets masked → a write changes only the edited key and keeps every other
// field. Saved secrets have no reveal path. Real SDK worker, test Gateway, owned target fixture; no paid calls.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentTools, getCurrentSystemMessage, getSystemMessageText } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "prk-plugin-config-"));
  onCleanup(() => rm(root, { recursive: true, force: true }));
  const workerCwd = join(root, "cwd");
  await mkdir(workerCwd);
  const pluginFile = join(root, "plugin", "web-access.json");
  await mkdir(join(root, "plugin"));
  const original = { search: { provider: "exa", maxResults: 5 }, keys: { exaApiKey: "exa_plain_secret" }, untouched: { nested: [1, 2], flag: true } };
  await writeFile(pluginFile, JSON.stringify(original));
  const sections = [
    { title: "搜索", fields: [
      { key: "search.provider", label: "搜索引擎", type: "select", options: ["exa", "brave"], default: "exa" },
      { key: "search.maxResults", label: "最多结果数", type: "number", default: 5 },
    ] },
    { title: "密钥", fields: [{ key: "keys.exaApiKey", label: "Exa API Key", type: "string", secret: true }] },
  ];

  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "plugin-config", models: [{ id: "primary" }], tokensPerSecond: 10_000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const contexts = [];
  provider.setResponses(Array.from({ length: 20 }, () => async (context) => {
    contexts.push(context);
    if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("DONE");
    return fauxAssistantMessage(fauxToolCall("tool_call", { name: "plugin_config", args: { action: "set", provider: "pi-web-access", file: pluginFile, sections } }), { stopReason: "toolUse" });
  }));
  const host = await createGatewayHost({
    cwd: root, home: root, historyDir: join(root, "history"), model: "plugin-config/primary",
    config: parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, session: { workerTools: "direct", capabilities: { "lazy:group:tools:package:<inline:plugin-config>": true } } }),
    targets: [executionTargetFromConfig({ ...config, id: "local", label: "Local", local: true, cwd: workerCwd })],
  }, { runtimeDependencies: { model: provider.getModel("primary"), modelRuntime, thinkingLevel: "off", cwd: root, agentDir: root } });
  onCleanup(() => host.close());
  const gateway = await startGateway(host, join(root, "gateway.sock"));
  onCleanup(() => gateway.close());
  const web = await startWebApplication({ socket: join(root, "gateway.sock"), host: "127.0.0.1", port: 0 });
  onCleanup(() => web.close());
  const api = async (route, body) => {
    const origin = new URL(web.server.url).origin;
    const response = await fetch(`${origin}/api/plugin-config/${route}`, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };

  await prepareGatewayEnvironment(host, root, "local");
  const worker = (await host.createSession({ target: "local", cwd: workerCwd })).session.sessionId;
  const operation = await host.session(worker).submit({ requestId: "set-1", message: "configure pi-web-access" });
  assert.equal((await operation.completion).status, "completed");
  const declared = getCurrentTools(contexts[0].messages).map((tool) => tool.name);
  assert(!declared.includes("plugin_config"), "direct mode hides lazy plugin_config");
  assert(declared.includes("tool_search") && declared.includes("tool_call"), "direct mode declares discovery and invocation");
  assert(getSystemMessageText(getCurrentSystemMessage(contexts[0].messages)).includes("plugin_config:"));
  const result = host.session(worker).getSnapshot().messages.findLast((message) => message.role === "toolResult" && message.toolName === "tool_call");
  assert.equal(result.isError, false, "the model's set call succeeds");

  const stored = JSON.parse(await readFile(join(root, "config-schemas", "pi-web-access.json"), "utf8"));
  assert.equal(stored.file, pluginFile);
  assert.deepEqual(stored.sections, sections, "semantics land on disk as given");

  const read = await api("get", { provider: "pi-web-access" });
  assert.equal(read.status, 200);
  assert.equal(read.body.values.keys.exaApiKey, "••••••", "secret is masked by default");
  assert.deepEqual(read.body.secrets, ["keys.exaApiKey"]);
  assert.equal(read.body.values.search.maxResults, 5);
  assert.equal(JSON.stringify(read.body).includes("exa_plain_secret"), false, "no plain secret anywhere in get");

  const written = await api("write", { provider: "pi-web-access", changes: [{ key: "search.maxResults", value: 8 }] });
  assert.equal(written.status, 200);
  assert.deepEqual(JSON.parse(await readFile(pluginFile, "utf8")), { ...original, search: { provider: "exa", maxResults: 8 } }, "only the edited key changed");
  assert.equal((await api("write", { provider: "pi-web-access", changes: [{ key: "keys.exaApiKey", value: "••••••" }] })).status, 200, "the mask retains the saved secret");
  assert.deepEqual(JSON.parse(await readFile(pluginFile, "utf8")).keys, original.keys);
  assert.equal((await api("write", { provider: "pi-web-access", changes: [{ key: "keys.exaApiKey", value: "" }] })).status, 200, "an empty secret retains the saved value");
  assert.deepEqual(JSON.parse(await readFile(pluginFile, "utf8")).keys, original.keys);
  const replacement = await api("write", { provider: "pi-web-access", changes: [{ key: "keys.exaApiKey", value: "replacement_secret" }] });
  assert.equal(replacement.status, 200);
  assert.equal(JSON.parse(await readFile(pluginFile, "utf8")).keys.exaApiKey, "replacement_secret");
  assert.equal(replacement.body.values.keys.exaApiKey, "••••••", "replacement is also masked");
  assert.equal(JSON.stringify(replacement.body).includes("replacement_secret"), false);

  // Only a file path (the UI's 添加配置文件路径): a missing file is created by the first write.
  const fresh = join(root, "plugin", "fresh.json");
  const added = await api("set", { provider: "@scope/fresh", file: fresh });
  assert.deepEqual([added.body.configured, added.body.exists, added.body.sections], [true, false, []]);
  assert.equal((await api("set", { provider: "x", file: "relative/path.json" })).status, 400, "relative paths are rejected");
  await api("write", { provider: "@scope/fresh", changes: [{ key: "a.b", value: true }] });
  assert.deepEqual(JSON.parse(await readFile(fresh, "utf8")), { a: { b: true } });
  console.log("PASS plugin_config: faux model set → semantics on disk → masked get → single-key atomic write; mask/empty retain saved secrets and new values replace them; path-only provider created on write");
}, { pythonExecutable: process.env.PI_TEST_PYTHON });
