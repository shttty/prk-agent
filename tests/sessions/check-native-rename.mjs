import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime, SessionManager, SettingsManager, createAgentSessionFromServices, createAgentSessionServices } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { connectWebGateway } from "../../src/http/gateway-connection/connect-gateway.ts";
import { startWebServer } from "../../src/http/listener/start-listener.ts";
import { createNativeInteractionService } from "../../src/sessions/native-interaction/assemble-native-interaction.ts";
import { createSessionHost } from "../../src/sessions/host/assemble-host.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { rawGateway } from "./history-protocol/open-raw-gateway.mjs";
import { waitForSessionCondition } from "./derivation/wait-for-session-condition.mjs";

const home = await mkdtemp(join(tmpdir(), "prk-native-rename-"));
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir, { recursive: true });
const release = Promise.withResolvers();
let host, endpoint, client, raw, webGateway, web, extensionHost;
try {
  await withTargetFixture(async ({ config, onCleanup }) => {
    onCleanup(async () => {
      release.resolve();
      try { await extensionHost?.close(); }
      finally {
        try { await web?.close(); }
        finally {
          try { await webGateway?.close(); }
          finally {
            raw?.socket.destroy();
            client?.disconnect();
            if (endpoint) await endpoint.close();
            else await host?.close();
          }
        }
      }
    });
    const models = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "rename-proof", models: [{ id: "controlled" }], tokensPerSecond: 10_000 });
    models.registerNativeProvider(provider.provider);
    let providerCalls = 0;
    provider.setResponses([async () => {
      providerCalls++;
      await release.promise;
      return fauxAssistantMessage("Rename proof completed.");
    }, () => { providerCalls++; return fauxAssistantMessage("Plain text retained."); }]);
    const configuration = parsePrkConfig({ monitor: { enabled: false }, session: { defaultSendMode: "plain", idleTimeoutMs: 60_000 } });
    host = await createGatewayHost({ home, cwd: home, config: configuration, model: "rename-proof/controlled", targets: [
      executionTargetFromConfig({ ...config, id: "fixture", label: "Rename fixture", local: true, tags: [], cwd: home }),
    ] }, { runtimeDependencies: { model: provider.getModel(), modelRuntime: models, thinkingLevel: "off", autoCompaction: false, cwd: home, agentDir } });
    const socket = join(home, "gateway.sock");
    endpoint = await startGateway(host, socket, configuration.gateway, configuration.limits);
    client = await connectGateway(socket);
    webGateway = await connectWebGateway({ socket });
    web = await startWebServer(webGateway, { port: 0, home, limits: configuration.limits });
    const created = await client.request("createSession", { target: "fixture", label: "Original name" });
    const worker = created.session.sessionId;
    const initialExport = await client.request("nativeAction", { sessionId: worker, requestId: "initial-entries", action: "export", args: { format: "jsonl" } });
    assert.equal(initialExport.status, "completed");
    const initialSettingsCount = initialExport.data.content.trim().split("\n").map((line) => JSON.parse(line)).filter((entry) => entry.customType === "gateway-native-session-state").length;
    const history = () => host.history(worker).session;
    const post = (path, body) => fetch(`${web.url}/api/sessions/${worker}/${path}`, {
      method: "POST", headers: { Origin: web.url, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
    const operation = await host.session(worker).submit({ requestId: "held-model", message: "Hold the actual SDK run while renaming." });
    assert.equal(operation.accepted, true);
    await waitForSessionCondition(() => providerCalls === 1, "controlled SDK model request entered");
    assert.equal(host.state(worker).state, "running");
    const catalog = await client.request("nativeCapabilities", { sessionId: worker });
    assert.equal(catalog.commands.find(({ name }) => name === "name").availability.enabled, true);
    assert.equal(catalog.actions.find(({ name }) => name === "name").enabled, true);
    raw = await rawGateway(socket);
    raw.send({ v: 1, id: 1, method: "subscribeSessions", params: {} });
    await raw.waitForFrames(1, "collection subscription");
    const renamed = [];
    const unsubscribe = host.subscribeSessions((event) => {
      if (event.type === "session_renamed" && event.sessionId === worker) renamed.push(history().label);
    });
    try {
      for (const [id, method, params, label] of [
        [2, "nativeAction", { sessionId: worker, requestId: "busy-native", action: "name", args: { name: "  Native busy name  " } }, "Native busy name"],
        [3, "send", { sessionId: worker, requestId: "busy-slash", message: "/name   Slash busy name  ", mode: "auto" }, "Slash busy name"],
        [4, "renameSession", { sessionId: worker, label: "  Direct busy name  " }, "Direct busy name"],
      ]) {
        const before = raw.frames.length;
        raw.send({ v: 1, id, method, params });
        await raw.waitForFrames(before + 2, `${method} rename event and result`);
        const frames = raw.frames.slice(before);
        assert.equal(frames[0].collection.type, "session_renamed", "The committed collection event precedes the request result");
        assert.equal(frames[0].collection.sessionId, created.session.sessionId);
        assert.equal(frames[1].id, id);
        assert.equal(frames[1].ok, true);
        if (method === "renameSession") assert.equal(frames[1].result.label, label);
        else {
          assert.equal(frames[1].result.status, "completed");
          assert.deepEqual(frames[1].result.data, { name: label });
          assert.equal(frames[1].result.requestId, params.requestId);
        }
        assert.equal(history().label, label);
        assert.equal(host.state(worker).state, "running");
      }
      assert.deepEqual(renamed, ["Native busy name", "Slash busy name", "Direct busy name"]);
      let rawId = 4;
      for (const name of ["", "   ", "bad\u0000name", "x".repeat(configuration.limits.labelChars + 1), 42]) {
        const request = { requestId: "invalid-native", action: "name", args: { name } };
        assert.equal((await post("native", request)).status, 400, "HTTP validates native name before forwarding");
        assert.equal((await post("rename", { label: name })).status, 400);
        for (const [method, params] of [["nativeAction", { sessionId: worker, ...request }], ["renameSession", { sessionId: worker, label: name }]]) {
          const before = raw.frames.length;
          const id = ++rawId;
          raw.send({ v: 1, id, method, params });
          await raw.waitForFrames(before + 1, `${method} socket rejection`);
          const rejected = raw.frames[before];
          assert.equal(rejected.id, id);
          assert.equal(rejected.ok, false);
          assert.equal(rejected.error.code, "INVALID_REQUEST");
        }
      }
      const invalidSlash = await client.request("send", { sessionId: worker, requestId: "invalid-slash", message: "/name bad\u0000name", mode: "auto" });
      assert.equal(invalidSlash.status, "failed");
      assert.deepEqual(invalidSlash.data, { executed: false });
      const structured = await client.request("send", { sessionId: worker, requestId: "structured-name", message: "/name Ignored", mode: "auto", references: [{ type: "text", source: "user", text: "reference" }] });
      assert.equal(structured.accepted, false);
      assert.equal(history().label, "Direct busy name");
      assert.equal(renamed.length, 3, "Rejected input never publishes a rename event");
      assert.equal(providerCalls, 1, "Renaming never queues a model request");
      release.resolve();
      assert.equal((await operation.completion).status, "completed");
      const plain = await post("send", { requestId: "default-plain-name", message: "/name bad\u0000name" });
      assert.equal(plain.status, 200);
      assert.equal((await plain.json()).accepted, true, "The Gateway's configured default plain mode does not parse labels");
      const plainOperation = host.session(worker);
      await waitForSessionCondition(() => plainOperation.isIdle, "plain name text completes");
      assert.equal(history().label, "Direct busy name");
      const exported = await client.request("nativeAction", { sessionId: worker, requestId: "rename-entries", action: "export", args: { format: "jsonl" } });
      assert.equal(exported.status, "completed");
      const entries = exported.data.content.trim().split("\n").map((line) => JSON.parse(line));
      assert.deepEqual(entries.filter(({ type }) => type === "session_info").map(({ name }) => name), ["Original name", "Native busy name", "Slash busy name", "Direct busy name"]);
      assert.equal(entries.filter((entry) => entry.customType === "gateway-native-session-state").length, initialSettingsCount, "Rename does not append unrelated SDK settings");
      await client.request("closeSession", { sessionId: worker });
      const closed = await client.request("nativeAction", { sessionId: worker, requestId: "closed-name", action: "name", args: { name: "Closed renamed" } });
      assert.equal(closed.status, "completed");
      assert.equal(history().label, "Closed renamed");
      assert.equal(host.state(worker).state, "closed");
      assert.equal(providerCalls, 2);
    } finally { unsubscribe(); }

    const calls = [];
    const services = await createAgentSessionServices({ cwd: home, agentDir, modelRuntime: models, settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }), resourceLoaderOptions: {
      noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      extensionFactories: [{ name: "rename-override", factory: (pi) => pi.registerCommand("name", { description: "Controlled extension override", handler: async (args) => { calls.push(args); } }) }],
    } });
    const { session } = await createAgentSessionFromServices({ services, sessionManager: SessionManager.inMemory(home), model: provider.getModel(), thinkingLevel: "off", tools: [], customTools: [] });
    extensionHost = createSessionHost({ session });
    const service = createNativeInteractionService();
    const target = { sessionId: session.sessionId, streamId: extensionHost.getSnapshot().streamId, state: "idle", readOnly: false, session, host: extensionHost, manager: session.sessionManager };
    assert.equal(service.catalog(target).commands.find(({ name }) => name === "name").source, "extension");
    const overridden = await service.send(target, { sessionId: target.sessionId, requestId: "extension-name", message: "/name bad\u0000name", mode: "auto" });
    assert.equal(overridden.accepted, true);
    assert.equal((await overridden.completion).status, "completed");
    assert.deepEqual(calls, ["bad\u0000name"], "Only a resolved builtin name treats its argument as a label");
  });
  console.log("PASS native rename: real busy SDK, Gateway implementation, boundary validation, collection-before-result, default plain and extension override");
} finally {
  await rm(home, { recursive: true, force: true });
}
