import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { createSessionHistory } from "../../src/sessions/history/assemble-history.ts";
import { projectBranchPage } from "../../src/sessions/history/project-branch-page.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { rawGateway } from "../sessions/history-protocol/open-raw-gateway.mjs";

await withTargetFixture(async ({ config: target, tempRoot: home, onCleanup }) => {
  const { agentDir } = initializePrkHome(home);
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false } }));
  const historyDir = join(home, "history");
  const history = await createSessionHistory({ cwd: home, directory: historyDir });
  const seed = (count, bytes) => {
    const manager = history.create("fixture", "Image-heavy sleeping session", home);
    manager.appendModelChange("large-observation", "controlled");
    const data = Buffer.alloc(bytes, 7).toString("base64");
    for (let i = 0; i < count; i++) {
      manager.appendMessage({ role: "user", content: [{ type: "text", text: `turn ${i}` }, { type: "image", mimeType: "image/png", data }], timestamp: Date.now() });
      manager.appendMessage(fauxAssistantMessage(`reply ${i}`));
    }
    history.setSleeping(manager.getSessionId(), true);
    return manager;
  };
  const session = seed(30, 120_000);
  const larger = seed(48, 150_000);
  const single = seed(1, 2_500_000);
  const sessionId = session.getSessionId();
  const config = parsePrkConfig({ session: { workerTools: "direct", noExtensions: true }, monitor: { enabled: false }, memory: { review: false }, targetCacheRoot: join(home, "target-cache") },
    { instances: [{ id: "fixture", label: "Fixture", ...target }] });
  const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
  const oldHistoryBytes = bytes(projectBranchPage(session));
  assert(oldHistoryBytes < config.limits.outputBytes && oldHistoryBytes * 2 > config.limits.outputBytes);
  assert(bytes(projectBranchPage(larger)) > config.limits.outputBytes);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "large-observation", models: [{ id: "controlled", contextWindow: 1_000_000 }], tokensPerSecond: 1_000_000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const host = await createGatewayHost({ cwd: home, home, historyDir, config, model: "large-observation/controlled" },
    { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir } });
  onCleanup(() => host.close());
  await prepareGatewayEnvironment(host, home, "fixture");
  const socket = join(home, "g.sock");
  const gateway = await startGateway(host, socket, config.gateway, config.limits);
  onCleanup(() => gateway.close());
  const client = await connectGateway(socket);
  onCleanup(() => client.disconnect());
  const slow = await rawGateway(socket);
  onCleanup(() => slow.socket.destroy());
  const send = (id, method, params) => slow.send({ v: 1, id, method, params });
  send(1, "subscribe", { sessionId });
  await slow.waitForFrames(1, "sleeping subscription");
  const asleep = slow.frames[0].result;
  assert.equal(asleep.state, "sleeping");
  slow.socket.pause();
  provider.setResponses([fauxAssistantMessage("Reply after waking")]);
  const accepted = await host.nativeSend(sessionId, { sessionId, requestId: "wake-and-complete", message: "Wake the session", mode: "plain" });
  assert.equal(accepted.accepted, true);
  assert.equal((await accepted.completion).status, "completed");
  // The two former full-page frames sit on the same paused Unix socket.
  send(2, "workbench", {});
  slow.socket.resume();
  const until = Date.now() + 5000;
  while (!slow.frames.some(({ id }) => id === 2)) {
    assert(Date.now() < until && !slow.socket.destroyed, "slow subscriber stays connected after wake + settlement");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const events = slow.frames.flatMap(({ event }) => event ? [event] : []);
  const snapshots = events.filter(({ type }) => type === "snapshot");
  const wake = snapshots.find(({ streamId }) => streamId !== asleep.streamId);
  assert(wake && events.indexOf(wake) < events.findIndex(({ type }) => type === "request_accepted"));
  const completed = events.find(({ type }) => type === "operation_completed");
  const settled = snapshots.find(({ streamId, sequence }) => streamId === completed.streamId && sequence === completed.sequence);
  assert(settled);
  for (const frame of slow.frames.filter(({ event }) => event)) assert(bytes(frame) + 1 < config.limits.outputBytes);
  for (const event of snapshots) for (const key of ["messages", "messageEntryIds", "historyBefore", "historyForkBefore", "compactions", "compactionEntryIds"]) {
    assert(!Object.hasOwn(event.details.snapshot, key), `pushed snapshot must not contain ${key}`);
  }
  const page = await client.request("historyPage", { sessionId, through: settled.details.snapshot.historyThrough });
  assert.equal(page.messages.at(-1).content[0].text, "Reply after waking");
  assert.equal(page.messageEntryIds.length, page.messages.length);
  assert(page.messages.some(({ content }) => Array.isArray(content) && content.some(({ type }) => type === "image")));

  const largerId = larger.getSessionId();
  const initial = await client.request("subscribe", { sessionId: largerId });
  const expected = projectBranchPage(larger).messageEntryIds;
  let ids = initial.messageEntryIds;
  let before = initial.historyBefore;
  assert(before, "the largest history must be paged even within 50 turns");
  while (before) {
    const older = await client.request("historyPage", { sessionId: largerId, before });
    assert(bytes(older) <= config.limits.historyPageBytes && older.messageEntryIds.length >= 2);
    assert.notEqual(older.historyBefore, before);
    before = older.historyBefore;
    ids = [...older.messageEntryIds, ...ids];
  }
  assert.deepEqual(ids, expected);
  await assert.rejects(client.request("subscribe", { sessionId: single.getSessionId() }), (error) =>
    error.code === "TOO_LARGE" && error.details.bytes > error.details.budgetBytes && typeof error.details.entryId === "string");
  assert.equal(client.lost, false);
  const frameBytes = (event) => bytes({ v: 1, sessionId, event }) + 1;
  console.log(`PASS slow observer, old history page bytes=${oldHistoryBytes}, wake/settled frame bytes=${frameBytes(wake)}/${frameBytes(settled)}; budgeted subscription and anchored paging`);
});
