import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";
import { createScenario } from "./create-scenario.mjs";
import { awaitTargetFile } from "./await-target-file.mjs";
import { observeProcesses } from "./observe-processes.mjs";

export async function checkRuntimeDisconnect(mode) {
  const scenario = await createScenario(mode, { gate: true });
  try {
    const first = scenario.acquire();
    const second = scenario.acquire();
    await first.request("monitor", "config", { intervalMs: 500 });
    const old = await scenario.identity();
    const entry = scenario.openings[0];
    const path = `${scenario.fixture.root}/side-effects.txt`;
    await first.request("files", "write", { cwd: scenario.fixture.root, path, content: "MARK\n" });
    await scenario.fixture.observe(`touch ${quoteShell(`${entry.prefix}.hold`)}\n`);
    // The unique MARK remains after each edit, so replay would append another observable hit.
    const args = { cwd: scenario.fixture.root, path, edits: [{ oldText: "MARK\n", newText: "MARK\nhit\n" }] };
    const pending = first.request("files", "edit", args).then((value) => ({ value }), (error) => ({ error }));
    await awaitTargetFile(scenario.fixture, `${entry.prefix}.blocked`);
    assert.equal(await scenario.fixture.observe(`cat ${quoteShell(path)}\n`), "MARK\nhit\n");
    const spawn = scenario.fixture.events.find((event) => event.kind === "spawn");
    assert.ok(spawn);
    const disconnectedPid = mode === "office" ? spawn.loginPid : spawn.wrapperPid;
    assert.ok(Number.isSafeInteger(disconnectedPid) && disconnectedPid > 0);
    process.kill(disconnectedPid, "SIGKILL");
    const result = await pending;
    assert.equal(result.error?.code, "unknown", String(result.error));
    for (let attempt = 0; !entry.lease.signal.aborted && attempt < 100; attempt++) await delay(20);
    assert.equal(entry.lease.signal.aborted, true);
    await assert.rejects(entry.lease.connection.info());
    const spawnCount = scenario.fixture.events.filter((event) => event.kind === "spawn").length;
    await assert.rejects(first.request("monitor", "config", {}));
    await assert.rejects(second.request("monitor", "config", {}));
    await delay(200);
    assert.equal(scenario.fixture.events.filter((event) => event.kind === "spawn").length, spawnCount, "Retired leases cannot reconnect");
    await observeProcesses(scenario.fixture, [old.pid, old.runtimePid, old.child, old.daemon], { gone: true });
    const fresh = scenario.acquire();
    await fresh.request("monitor", "config", { intervalMs: 500 });
    const current = await scenario.identity();
    assert.notEqual(current.generation, old.generation);
    assert.notEqual(current.daemon, old.daemon);
    assert.equal(scenario.openings.length, 2);
    assert.equal(await scenario.fixture.observe(`cat ${quoteShell(path)}\n`), "MARK\nhit\n", "Reconnect must not replay the unknown edit");
    await fresh.request("files", "edit", args);
    assert.equal(await scenario.fixture.observe(`cat ${quoteShell(path)}\n`), "MARK\nhit\nhit\n", "Only the explicit new request adds a second side effect");
    await fresh.release();
    await observeProcesses(scenario.fixture, [current.pid, current.runtimePid, current.child, current.daemon], { gone: true });
    return { scenario: "disconnect", old, current, disconnectedPid, outcome: result.error.code, sideEffectsBeforeReconnect: 1, sideEffectsAfterReconnect: 1, sideEffectsAfterExplicitRequest: 2, autonomousReconnects: 0 };
  } finally { await scenario.close(); }
}
