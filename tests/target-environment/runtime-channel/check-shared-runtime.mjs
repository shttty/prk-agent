import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createScenario } from "./create-scenario.mjs";
import { observeProcesses } from "./observe-processes.mjs";

export async function checkSharedRuntime(mode) {
  const scenario = await createScenario(mode);
  try {
    const first = scenario.acquire();
    const second = scenario.acquire();
    const ticks = [];
    first.subscribe((event) => { if (event.mod === "monitor" && event.t === "machine") ticks.push(event); });
    await first.request("monitor", "config", { intervalMs: 500 });
    await second.request("files", "write", { cwd: scenario.fixture.root, path: "shared.txt", content: "memory-pipe\n" });
    const read = await first.request("files", "read", { cwd: scenario.fixture.root, path: "shared.txt" });
    assert.match(JSON.stringify(read), /memory-pipe/u);
    for (let attempt = 0; ticks.length < 2 && attempt < 40; attempt++) await delay(100);
    assert.ok(ticks.length >= 2, "Real monitor module must emit recurring ticks");
    assert.equal(scenario.openings.length, 1, "Two channel leases must share one runtime");
    const identity = await scenario.identity();
    const alive = await observeProcesses(scenario.fixture, [identity.pid, identity.child, identity.daemon]);
    for (const pid of [identity.pid, identity.child, identity.daemon]) assert.match(alive, new RegExp(`(?:^|\\n)\\s*${pid}\\s`, "u"));
    await first.release();
    assert.equal(second.state().state, "ok");
    assert.equal(scenario.openings[0].lease.signal.aborted, false);
    await second.request("monitor", "config", { intervalMs: 500 });
    await second.release();
    await observeProcesses(scenario.fixture, [identity.pid, identity.child, identity.daemon], { gone: true });
    assert.equal(scenario.openings[0].lease.signal.aborted, true);
    return { scenario: "shared", identity, tickCount: ticks.length, beforeClose: alive, afterClose: "absent", opens: scenario.openings.length };
  } finally { await scenario.close(); }
}
