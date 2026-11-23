import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { SampleHistory } from "../../src/monitor/sample-history/assemble-sample-history.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(read, label) {
  const deadline = Date.now() + 20000;
  while (!await read()) {
    assert(Date.now() < deadline, `Timed out: ${label}`);
    await sleep(40);
  }
}
const ring = new SampleHistory(100, 3);
for (let at = 0; at < 5; at++) ring.push(at, at);
assert.deepEqual(ring.snapshot(4).map(({ value }) => value), [2, 3, 4]);
assert.deepEqual(ring.snapshot(105), [], "expired samples disappear without another write");

await withTargetFixture(async ({ config: connection, tempRoot }) => {
  const home = await mkdtemp(join(tmpdir(), "prk-monitor-history-"));
  let host;
  try {
    const modelRuntime = await ModelRuntime.create({ authPath: join(home, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "monitor-history", models: [{ id: "controlled" }] });
    modelRuntime.registerNativeProvider(provider.provider);
    const config = parsePrkConfig({ monitor: { historyWindowMs: 1600, fastIntervalMs: 500, slowIntervalMs: 60000 } });
    host = await createGatewayHost({ cwd: home, home, historyDir: join(home, "history"), model: "monitor-history/controlled", config,
      targets: [executionTargetFromConfig({ ...connection, id: "machine", label: "Machine", local: true, tags: [], cwd: tempRoot })],
    }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir: home } });
    const first = (await host.createSession({ target: "machine" })).session.sessionId;
    host.monitorFocus(first, true);
    await until(() => host.monitorHistory(first).machine.length >= 3, "history collected through real target terminal");
    const before = host.monitorHistory(first);
    const shared = (await host.createSession({ target: "machine" })).session.sessionId;
    const reopened = host.monitorHistory(shared);
    assert.equal(reopened.instance, "machine");
    assert(reopened.machine.some(({ at }) => at === before.machine.at(-1).at), "another session sees the instance's existing history");
    assert.equal(reopened.windowMs, 1600);
    const oldest = before.machine[0].at;
    await until(() => host.monitorHistory(first).machine[0]?.at > oldest, "short window evicts oldest real samples");
    host.monitorFocus(first, false);
    await host.closeSession(first);
    await host.closeSession(shared);
    const stopped = host.monitorHistory(first).machine.at(-1).at;
    await sleep(1800);
    assert.deepEqual(host.monitorHistory(first).machine, [], "stopped histories expire without starting a collector");
    assert(stopped > oldest);
    assert.equal(provider.state.callCount, 0);
    console.log("PASS Gateway real target history: shared across sessions, configured eviction, stopped expiry, zero model calls");
  } finally {
    await host?.close();
    await rm(home, { recursive: true, force: true });
  }
}, { allowHidden: true });
