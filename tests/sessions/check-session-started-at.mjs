import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "prk-start-"));
  let host, server, client;
  const release = Promise.withResolvers();
  const releaseNext = Promise.withResolvers();
  onCleanup(async () => {
    release.resolve();
    await client?.disconnect();
    releaseNext.resolve();
    if (server) await server.close(); else await host?.close();
    await rm(root, { recursive: true, force: true });
  });
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const provider = fauxProvider({ provider: "started-at", tokensPerSecond: 10000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const entered = Promise.withResolvers();
  provider.setResponses([
    async () => { entered.resolve(); await release.promise; return fauxAssistantMessage("First run completed."); },
    fauxAssistantMessage("Queued input completed."),
    async () => { await releaseNext.promise; return fauxAssistantMessage("Second run completed."); },
  ]);
  host = await createGatewayHost({ cwd: root, home: root,
    model: `${provider.getModel().provider}/${provider.getModel().id}`,
    config: parsePrkConfig({ session: { workerTools: "direct" }, memory: { review: false }, monitor: { enabled: false } }),
    targets: [executionTargetFromConfig({ ...config, id: "local", label: "Local", local: true, cwd: root })],
  }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir: root } });
  server = await startGateway(host, join(root, "gw.sock"));
  client = await connectGateway(join(root, "gw.sock"));
  const worker = (await client.request("createSession", { target: "local" })).session.sessionId;
  const initial = await client.request("workbench", {});
  assert.equal(initial.sessions.find((row) => row.sessionId === worker).startedAt, undefined);
  const before = Date.now();
  const first = await host.session(worker).submit({ requestId: "first", message: "Hold the first run." });
  assert.equal(first.accepted, true);
  await entered.promise;
  const active = host.session(worker).getSnapshot();
  const wire = await client.request("workbench", {});
  const startedAt = wire.sessions.find((row) => row.sessionId === worker).startedAt;
  assert(Number.isSafeInteger(startedAt) && startedAt >= before && startedAt <= Date.now());
  assert.equal(active.operation.startedAt, startedAt);
  assert.equal(host.session(worker).startedAt, startedAt);
  const queued = await host.session(worker).submit({ requestId: "queued", message: "Complete after the first.", queue: "followUp" });
  assert.equal(queued.accepted, true);
  assert.equal(queued.operationId, first.operationId);
  assert.equal(host.workbench().sessions.find((row) => row.sessionId === worker).startedAt, startedAt);
  release.resolve();
  assert.equal((await first.completion).status, "completed");
  assert.equal((await queued.completion).status, "completed");
  assert.equal(host.workbench().sessions.find((row) => row.sessionId === worker).startedAt, undefined);
  assert.equal(host.session(worker).startedAt, undefined);
  const nextBefore = Date.now();
  const second = await host.session(worker).submit({ requestId: "second", message: "A new independent run." });
  assert.equal(second.accepted, true);
  assert.notEqual(second.operationId, first.operationId);
  const next = host.session(worker).getSnapshot().operation;
  assert(next.startedAt >= nextBefore && next.startedAt >= startedAt);
  releaseNext.resolve();
  assert.equal((await second.completion).status, "completed");
  console.log("PASS: real Gateway wire rows expose epoch-ms run starts, queued input retains one start, idle clears it, and the next run starts anew");
});
