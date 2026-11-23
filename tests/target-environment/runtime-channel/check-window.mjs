import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createScenario } from "./create-scenario.mjs";
import { observeProcesses } from "./observe-processes.mjs";

export async function checkWindow(mode, kind, settlement) {
  const scenario = await createScenario(mode, { timeoutMs: 3000 });
  let identity;
  let stopped = false;
  try {
    const first = scenario.acquire();
    const second = scenario.acquire();
    await first.request("monitor", "config", { intervalMs: 500 });
    identity = await scenario.identity();
    await scenario.fixture.observe(`kill -STOP ${identity.runtimePid}\n`);
    stopped = true;
    const count = kind === "count" ? 32 : 2;
    const args = kind === "count" ? { intervalMs: 500 } : { intervalMs: 500, padding: "x".repeat(700000) };
    const pending = Array.from({ length: count }, () => first.request("monitor", "config", args).then(
      (value) => ({ value }), (error) => ({ error }),
    ));
    await assert.rejects(second.request("monitor", "config", args), (error) => error.code === "BUSY" && error.transient === true);
    await assert.rejects(second.request("monitor", "config", { padding: "x".repeat(1048576) }), (error) => error.code === "FRAME_TOO_LARGE");
    if (settlement === "cancel") await first.release();
    const results = await Promise.all(pending);
    assert.ok(results.every((result) => result.error), "Stopped runtime cannot acknowledge any request");
    const expected = settlement === "cancel" ? /lease released/iu : /timed out/iu;
    for (const result of results) assert.match(result.error.message, expected);
    // Caller settlement is not consumption; both count and byte credits must still be held.
    await assert.rejects(second.request("monitor", "config", args), (error) => error.code === "BUSY");
    await scenario.fixture.observe(`kill -CONT ${identity.runtimePid}\n`);
    stopped = false;
    let admitted = false;
    for (let attempt = 0; attempt < 100 && !admitted; attempt++) {
      try {
        await second.request("monitor", "config", args);
        admitted = true;
      } catch (error) {
        // BUSY was never submitted, so only these rejected probes are safe to try again.
        if (error.code !== "BUSY") throw error;
        await delay(20);
      }
    }
    assert.equal(admitted, true, "Only real target replies may reopen admission");
    assert.equal(second.state().state, "ok");
    assert.equal(scenario.openings.length, 1);
    await first.release();
    await second.release();
    await observeProcesses(scenario.fixture, [identity.pid, identity.child, identity.daemon], { gone: true });
    return { scenario: `window-${kind}-${settlement}`, identity, heldRequests: count, payloadBytes: kind === "bytes" ? 700000 : undefined, busyAfterCallerSettlement: true, resumedAdmission: true };
  } finally {
    if (stopped && identity) await scenario.fixture.observe(`kill -CONT ${identity.runtimePid} 2>/dev/null || true\n`);
    await scenario.close();
  }
}
