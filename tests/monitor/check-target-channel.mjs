// Real target pipe: request errors, monitor events and shared lease ownership. No model calls.
import assert from "node:assert/strict";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await check(); if (value) return value; await sleep(50); }
  throw new Error(`Timed out: ${label}`);
}
await withTargetFixture(async ({ config, runtime, onCleanup }) => {
  let opens = 0;
  let closed = false;
  const channels = createTargetChannels({
    options: { startTimeoutMs: 10000 },
    async open(_machine, signal, limits) {
      opens++;
      const transport = await openProcessTransport(await runtime.acquire(), config.python, config.cwd, signal, 10000, limits);
      transport.onClose(() => { closed = true; });
      return { transport, command: "" };
    },
  });
  const monitor = channels.acquire("fixture");
  const consumer = channels.acquire("fixture");
  onCleanup(async () => { await monitor.release(); await consumer.release(); });
  const samples = [];
  monitor.subscribe((event) => { if (event.mod === "monitor" && event.t === "machine") samples.push(event); });
  await monitor.request("monitor", "config", { intervalMs: 500 });
  await consumer.request("monitor", "config", { intervalMs: 500 });
  await until(() => samples.length, "monitor sample");
  assert.equal(opens, 1, "two consumer leases share one runtime");
  await assert.rejects(monitor.request("monitor", "no-such-operation"), /unknown|unsupported/i);
  await consumer.request("monitor", "config", { intervalMs: 500 });
  const count = samples.length;
  await until(() => samples.length > count, "monitor continues after a module exception");

  await monitor.release();
  assert.equal(closed, false, "remaining consumer lease keeps channel alive");
  await consumer.request("monitor", "config", { intervalMs: 500 });
  await consumer.release();
  await until(() => closed, "last lease closes owned process transport");
  console.log("PASS target channel: shared leases, module exception isolation, monitor events, last-lease shutdown");
});
