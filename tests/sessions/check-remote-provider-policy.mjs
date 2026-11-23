// Real Pi sessions + owned local daemon/process target; no model network or transport mocks.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { ArtifactStore } from "../../src/artifacts/store/assemble-store.ts";
import { resolvePluginPackage } from "../../src/plugins/packages/resolve-package.ts";
import { prepareRemoteExtensions } from "../../src/remote-extensions/session-load/prepare.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createHostFixture } from "../target-environment/host/create-host-fixture.mjs";
import { until } from "./remote-extensions/wait-condition.mjs";

assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Only owned process fixtures are allowed");
assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required");
assert.equal(process.env.SHELL, "/bin/bash");
const root = await mkdtemp(join(tmpdir(), "prk-remote-provider-policy-"));
const oldHome = process.env.HOME;
process.env.HOME = join(root, "home");
try {
  const home = join(root, "prk");
  const { agentDir } = initializePrkHome(home);
  const { DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, createAgentSession } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
  const store = new ArtifactStore(join(home, "assets"));
  const source = join(root, "plugin");
  await mkdir(source);
  const entry = join(source, "index.mjs");
  await writeFile(entry, await readFile(new URL("../fixtures/remote-provider-policy.mjs", import.meta.url), "utf8"));
  await writeFile(join(source, "package.json"), JSON.stringify({ name: "@prk-tests/remote-provider-policy", version: "1.0.0", type: "module", pi: { extensions: ["index.mjs"] } }));
  const pkg = resolvePluginPackage({ source, enabled: true, location: "host" }, home, agentDir);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const faux = fauxProvider({ tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(faux.provider);
  const modelIds = () => modelRuntime.getModels().map((model) => `${model.provider}/${model.id}`);
  const before = modelIds();
  const machine = process.argv[2] ?? "local";
  const fixture = await createHostFixture(machine, store);
  const projectEntry = machine === "office" ? await fixture.write("index.mjs", await readFile(entry, "utf8")) : entry;
  try {
    const config = parsePrkConfig({ monitor: { enabled: false }, targetConnection: { startTimeoutMs: 15000 } });
    const channels = fixture.channels;
    for (const mode of ["package", "project"]) for (const owned of [true, false]) {
      const logs = [];
      const statuses = [];
      let generation;
      const remote = await prepareRemoteExtensions({
        target: { id: "fixture", label: "Fixture", local: machine === "local", python: machine === "office" ? process.env.PI_TEST_REMOTE_PYTHON : process.env.PI_TEST_PYTHON, kernel: { cwd: fixture.fixture.root }, tags: [] },
        channels, store, storeDir: store.directory, nativeTools: false, projectTrusted: () => true,
        packages: mode === "package" ? [pkg] : [], projectExtensions: mode === "project" ? [projectEntry] : [],
        providerOwnerIds: owned ? ["gateway-owned", "unowned"] : ["gateway-owned"],
        hostOptions: { ...config.remoteHost, runtime: "node" },
        onRemoteExtensionEvent(event) { if (event.t === "log") logs.push(String(event.data)); },
        onRemoteExtensionGeneration(host) { generation = host; },
        onStatus(value) { statuses.push(value); },
      });
      const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
      const loader = new DefaultResourceLoader({ cwd: root, agentDir, settingsManager,
        noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
        systemPrompt: "Exercise only the owned target provider policy fixture.", extensionFactories: remote.factories });
      let session;
      try {
        await loader.reload();
        assert.deepEqual(loader.getExtensions().errors, []);
        remote.inspect(loader.getExtensions().extensions, []);
        assert.equal(statuses.at(-1)?.find((status) => status.error)?.error, undefined, JSON.stringify(statuses.at(-1)));
        assert(generation?.registration);
        assert.notEqual(generation.registration.pid, process.pid);
        const registration = generation.registration;
        assert.equal(registration.packages[0].error, undefined);
        assert.deepEqual(registration.commands.map((command) => command.name), ["provider_policy_command"]);
        assert(registration.handlers.some((handler) => handler.event === "session_start"));
        assert.equal(remote.providerErrors.length, owned ? 0 : 2);
        ({ session } = await createAgentSession({ cwd: root, agentDir, modelRuntime, model: faux.getModel(), thinkingLevel: "off",
          resourceLoader: loader, settingsManager, sessionManager: SessionManager.inMemory(root), tools: ["remote_provider_policy"] }));
        await session.bindExtensions({});
        await session.prompt("/provider_policy_command");
        const id = randomUUID();
        faux.setResponses([fauxAssistantMessage(fauxToolCall("remote_provider_policy", {}, { id }), { stopReason: "toolUse" }), fauxAssistantMessage("Observed target policy.")]);
        await session.prompt("Exercise the target provider policy");
        const result = session.messages.findLast((message) => message.role === "toolResult" && message.toolCallId === id);
        assert(result && !result.isError, JSON.stringify(result));
        assert.equal(result.details.hooks, 101, "The original host command handler ran before the tool");
        assert.equal(result.details.pid, registration.pid);
        assert.equal(remote.providerErrors.length, owned ? 0 : 6, "Load, retained hook and live tool must share the policy");
        for (const diagnostic of remote.providerErrors) {
          assert.equal(diagnostic.code, "PROVIDER_POLICY");
          assert.equal(diagnostic.providerId, "unowned");
          assert(["register", "unregister"].includes(diagnostic.operation));
          assert(diagnostic.path.endsWith("index.mjs"));
          assert.equal(diagnostic.source, registration.packages[0].name);
          assert.match(diagnostic.error, /Gateway bootstrap.*models\.json/u);
        }
        assert.deepEqual(remote.providerErrors.map((error) => error.operation), owned ? [] : ["register", "unregister", "register", "unregister", "register", "unregister"]);
        assert.equal(statuses.at(-1)[0].error, undefined);
        assert.equal(statuses.at(-1)[0].providerErrors.length, owned ? 0 : 6, "Live diagnostics publish through extension status");
        await until(() => logs.join("\n"), (value) => value.includes("provided by Gateway"));
        if (!owned) await until(() => logs.join("\n"), (value) => value.includes('provider "unowned" has no Gateway plugin owner'));
        else assert(!logs.join("\n").includes("has no Gateway plugin owner"));
        assert.deepEqual(modelIds(), before);
        assert.equal(modelRuntime.getRegisteredProviderConfig("unowned"), undefined);
        assert.equal(modelRuntime.getRegisteredNativeProvider("unowned"), undefined);
      } finally {
        await remote.close();
        await session?.dispose();
      }
    }
  } finally { await fixture.close(); }
  console.log("PASS remote provider policy: owned IDs acknowledge; unknown register/unregister report structured live errors without losing tools/hooks/commands or changing shared models");
} finally {
  if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome;
  await rm(root, { recursive: true, force: true });
}
