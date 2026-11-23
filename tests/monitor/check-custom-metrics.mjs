import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createMonitorService } from "../../src/monitor/session-monitor/assemble-session-monitor.ts";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(read, label) {
  const deadline = Date.now() + 20000;
  while (!await read()) {
    assert(Date.now() < deadline, `Timed out: ${label}`);
    await sleep(40);
  }
}
await withTargetFixture(async ({ config: connection, runtime, tempRoot }) => {
  const counter = join(tempRoot, "metric-count");
  const forbidden = join(tempRoot, "timed-out-descendant");
  const metrics = [
    { name: "number", command: `printf x >> '${counter}'; printf 'value: -1.25e2'`, interval_s: 0.2, parse: "number", unit: "W" },
    { name: "json", command: `printf '{"sensors":[{"value":42.25}]}'`, interval_s: 0.2, parse: "json:sensors.0.value" },
    { name: "bad", command: "printf unavailable", interval_s: 0.2, parse: "number" },
    { name: "timeout", command: `(sleep 2; printf late > '${forbidden}') & wait`, interval_s: 0.2, parse: "number" },
    { name: "flood", command: "yes 7", interval_s: 0.2, parse: "number" },
    { name: "string", command: `printf '{"value":"42"}'`, interval_s: 0.2, parse: "json:value" },
  ];
  const instance = { ...connection, id: "machine", label: "Machine", customMetrics: metrics };
  for (const patch of [{ chart: "bar" }, { parse: "json:a..b" }, { interval_s: 0 }]) {
    assert.throws(() => parsePrkConfig({}, { instances: [{ ...instance, customMetrics: [{ ...metrics[0], ...patch }] }] }), /customMetrics/);
  }
  assert.throws(() => parsePrkConfig({}, { instances: [{ ...instance, customMetrics: [metrics[0], metrics[0]] }] }), /unique/);
  const config = parsePrkConfig({ monitor: { fastIntervalMs: 500, slowIntervalMs: 60000, focusLeaseMs: 3000, historyWindowMs: 1600, customTimeoutMs: 700, customMaxOutputBytes: 1024 } }, { instances: [instance] });
  const channels = createTargetChannels({ options: config.targetConnection, open: async (_machine, signal, limits) => ({
    transport: await openProcessTransport(await runtime.acquire(), connection.python, connection.cwd, signal, config.targetConnection.startTimeoutMs, limits), command: "",
  }) });
  const keeper = channels.acquire("machine");
  const monitor = createMonitorService({ options: config.monitor, channels, customMetrics: () => config.instances[0].customMetrics,
    agentChanges: () => ({ added: 0, removed: 0, files: [] }), agentDiff: () => "" });
  try {
    monitor.setSessions([{ sessionId: "first", machine: "machine", cwd: tempRoot }, { sessionId: "second", machine: "machine", cwd: tempRoot }]);
    await until(() => monitor.get("first")?.state === "ok", "real target process channel ready");
    await sleep(600);
    await assert.rejects(access(counter), "configured commands stay off while cards are closed");
    monitor.focus("first", true);
    const result = (name) => monitor.get("first").customMetrics.find((metric) => metric.name === name)?.sample?.value;
    await until(() => metrics.every(({ name }) => result(name)), "each command independently delivers a result");
    assert.deepEqual(result("number"), { value: -125, error: null });
    assert.deepEqual(result("json"), { value: 42.25, error: null });
    assert.match(result("bad").error, /no number/);
    assert.match(result("timeout").error, /timed out/);
    assert.match(result("flood").error, /exceeded/);
    assert.match(result("string").error, /finite number/);
    assert.equal(monitor.get("first").state, "ok");
    assert.deepEqual(monitor.get("second").customMetrics, monitor.get("first").customMetrics);
    assert.equal(monitor.history("machine").customMetrics.find(({ name }) => name === "number").samples.at(-1).value.value, -125);
    await keeper.request("skills", "discover", { cwd: tempRoot });
    monitor.focus("second", true);
    monitor.focus("first", false);
    const stillOpen = (await readFile(counter)).length;
    await until(async () => (await readFile(counter)).length > stillOpen, "another open session keeps custom commands running");
    monitor.focus("second", false);
    await sleep(700);
    const closed = (await readFile(counter)).length;
    await sleep(1300);
    assert.equal((await readFile(counter)).length, closed, "closing all cards stops commands while another channel lease stays alive");
    await assert.rejects(access(forbidden), "timed-out process-group descendants were killed");
    monitor.focus("first", true);
    await until(async () => (await readFile(counter)).length > closed, "reopening starts commands again");
    await sleep(4200);
    const expired = (await readFile(counter)).length;
    await sleep(1200);
    assert.equal((await readFile(counter)).length, expired, "expired card lease stops commands without explicit close");
    assert.deepEqual(monitor.history("machine").customMetrics.find(({ name }) => name === "number").samples, [], "custom history obeys the same short window");
    await keeper.request("skills", "discover", { cwd: tempRoot });
    monitor.focus("first", true);
    await until(async () => (await readFile(counter)).length > expired, "commands resume before session removal");
    monitor.setSessions([]);
    await sleep(700);
    const removed = (await readFile(counter)).length;
    await sleep(1200);
    assert.equal((await readFile(counter)).length, removed, "removing the last awake session stops commands despite another channel consumer");
    await keeper.request("skills", "discover", { cwd: tempRoot });
    console.log(`PASS real Jupyter custom metrics: number/json, isolated parse/timeout/overflow errors, process-group cleanup, shared card leases, close/expiry counters ${closed}/${expired}, bounded history`);
  } finally {
    await monitor.close();
    await keeper.release();
  }
}, { allowHidden: true });
