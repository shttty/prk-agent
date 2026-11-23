import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "smol-toml";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../../fixtures/target-fixture.mjs";
import { startResponsesStub } from "../prompt-sections/start-responses-stub.mjs";
import { prepareGatewayEnvironment } from "../../fixtures/prepare-gateway-environment.mjs";

export async function withSleepSettingsFixture(check, { idleTimeoutMs = 60_000, scopedModelsMax } = {}) {
  await withTargetFixture(async ({ config, tempRoot: home, owned, onCleanup }) => {
    assert(owned, "Sleeping-settings checks require an owned target fixture");
    const { agentDir } = initializePrkHome(home);
    await mkdir(agentDir, { recursive: true });
    await writeFile(join(agentDir, "settings.json"), JSON.stringify({ cacheWarming: "off", compaction: { enabled: false }, retry: { enabled: false } }));
    const document = { session: { noContextFiles: true, noSkills: true, idleTimeoutMs, workerTools: "code", localTools: false },
      memory: { review: false }, monitor: { enabled: false }, ...(scopedModelsMax === undefined ? {} : { limits: { scopedModelsMax } }) };
    await writeFile(join(home, "config.toml"), stringify(document));
    const [{ ModelRuntime, SessionManager }, { createGatewayHost }, { parsePrkConfig }, { startGateway }, { connectGateway }] = await Promise.all([
      import("@earendil-works/pi-coding-agent"), import("../../../src/gateway/host/start-host.ts"), import("../../../src/config/document/parse-prk-config.ts"),
      import("../../../src/gateway/socket-server/start-listener.ts"), import("../../../src/gateway/socket-client/connect-client.ts"),
    ]);
    const provider = await startResponsesStub();
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    runtime.registerProvider("sleepset", { api: "openai-responses", baseUrl: provider.url, apiKey: "owned-loopback-only", models: [
      { id: "primary", name: "Sleeping settings primary", reasoning: true },
      { id: "alternate", name: "Sleeping settings alternate", reasoning: true },
      { id: "plain", name: "Sleeping settings without reasoning", reasoning: false },
    ].map((model) => ({ ...model, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 1024 })) });
    runtime.registerProvider("sleepset-no-auth", { api: "openai-responses", baseUrl: provider.url, models: [{
      id: "controlled", name: "Owned unavailable catalog choice", reasoning: false, input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 1024,
    }] });
    assert(runtime.getModel("sleepset-no-auth", "controlled"));
    assert(!runtime.getAvailableSnapshot().some(({ provider }) => provider === "sleepset-no-auth"));
    const model = runtime.getModel("sleepset", "primary");
    assert(model);
    assert.equal(new URL(model.baseUrl).hostname, "127.0.0.1");
    const historyDir = join(home, "sessions"), socket = join(home, "sleepset.sock");
    const options = { home, cwd: home, historyDir, model: "sleepset/primary", config: parsePrkConfig(document), targets: [
      executionTargetFromConfig({ ...config, id: "fixture", label: "Owned fixture", local: true, tags: [], cwd: home }),
    ] };
    const dependencies = { runtimeDependencies: { model, modelRuntime: runtime, thinkingLevel: "off", autoCompaction: false, cwd: home, agentDir } };
    let host, endpoint, client;
    const events = [];
    const start = async () => {
      host = await createGatewayHost(options, dependencies);
      endpoint = await startGateway(host, socket);
      client = await connectGateway(socket);
      client.onEvent((event, sessionId) => events.push({ event, sessionId }));
    };
    const stop = async () => {
      client?.disconnect();
      if (endpoint) await endpoint.close();
      else await host?.close();
      endpoint = client = host = undefined;
    };
    onCleanup(async () => { try { await stop(); } finally { await provider.close(); } });
    const until = async (predicate, label) => {
      const deadline = Date.now() + 20_000;
      while (!await predicate()) {
        assert(Date.now() < deadline, `Timed out: ${label}`);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    };
    const request = (method, params) => client.request(method, params);
    const state = (sessionId) => request("state", { sessionId });
    const action = (sessionId, action, args = {}) => request("nativeAction", { sessionId, requestId: randomUUID(), action, args });
    const change = async (sessionId, name, args) => {
      const result = await action(sessionId, name, args);
      assert.equal(result.status, "completed", JSON.stringify(result));
      return result.data;
    };
    const send = async (sessionId, message, queue) => {
      const result = await request("send", { sessionId, requestId: randomUUID(), message, mode: "plain", ...(queue ? { queue } : {}) });
      assert.equal(result.accepted, true, JSON.stringify(result));
      await until(() => host.state(sessionId).recentOperations?.some((operation) => operation.operationId === result.operationId), "real SDK operation settles");
      const operation = host.state(sessionId).recentOperations.find((operation) => operation.operationId === result.operationId);
      assert.equal(operation.status, "completed", JSON.stringify(operation));
      assert.deepEqual(provider.failures, []);
      return result;
    };
    const create = async (label = "Sleeping settings") => {
      await prepareGatewayEnvironment(host, home, "fixture");
      const sessionId = (await request("createSession", { target: "fixture", label })).session.sessionId;
      await send(sessionId, `SLEEPSET_SEED_${randomUUID()}`);
      return sessionId;
    };
    const stored = async (sessionId) => {
      const entry = (await SessionManager.list(home, historyDir)).find((entry) => entry.id === sessionId);
      assert(entry, `Real SDK file exists for ${sessionId}`);
      return entry;
    };
    const entries = async (sessionId) => (await readFile((await stored(sessionId)).path, "utf8")).trim().split("\n").map(JSON.parse);
    const markUnavailable = async (sessionId, spec = "sleepset/removed") => {
      assert.equal(host, undefined, "Only append unavailable fixture entries after Gateway has released its writer");
      const file = await stored(sessionId), separator = spec.indexOf("/");
      SessionManager.open(file.path, historyDir).appendModelChange(spec.slice(0, separator), spec.slice(separator + 1));
    };
    const kernels = async () => host.workbench().sessions
      .filter(({ kernel }) => kernel?.connectionStatus === "connected" && kernel.kernelId)
      .map(({ kernel }) => kernel.kernelId).sort();
    const evidence = async (name, data) => {
      if (!process.env.PI_TEST_WEB_EVIDENCE) return;
      await mkdir(process.env.PI_TEST_WEB_EVIDENCE, { recursive: true });
      await writeFile(join(process.env.PI_TEST_WEB_EVIDENCE, name), `${JSON.stringify(data, null, 2)}\n`);
    };
    await start();
    await check({ get host() { return host; }, get client() { return client; }, home, socket, provider, events,
      request, state, action, change, send, create, entries, start, stop, markUnavailable, kernels, until, evidence });
  }, { allowHidden: true });
}
