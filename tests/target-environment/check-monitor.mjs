import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { ArtifactStore } from "../../src/artifacts/store/assemble-store.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createMonitorService } from "../../src/monitor/session-monitor/assemble-session-monitor.ts";
import { agentChanges } from "../../src/monitor/agent-edits/agent-changes.ts";
import { agentDiff } from "../../src/monitor/agent-edits/agent-diff.ts";
import { createHostFixture } from "./host/create-host-fixture.mjs";
import { observeProcesses } from "./runtime-channel/observe-processes.mjs";

const mode = process.argv[2] ?? "local";
const home = await mkdtemp(join(tmpdir(), "prk-S5-monitor-"));
const owned = await createHostFixture(mode, new ArtifactStore(join(home, "assets")));
const config = parsePrkConfig({ monitor: { fastIntervalMs: 500, slowIntervalMs: 60000, historyWindowMs: 60000 } });
const manager = SessionManager.inMemory(owned.fixture.root);
const sessionId = manager.getSessionId();
const monitor = createMonitorService({ channels: owned.channels, options: config.monitor, log: console.error,
  agentChanges: () => agentChanges(manager.getBranch()), agentDiff: (_id, path) => agentDiff(manager.getBranch(), path) });
try {
  monitor.setSessions([{ sessionId, machine: owned.id, cwd: owned.fixture.root }]);
  monitor.focus(sessionId, true);
  const deadline = Date.now() + 20000;
  while (!monitor.history(owned.id).machine.length) {
    assert(Date.now() < deadline, `No real target sample: ${JSON.stringify(monitor.get(sessionId))}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(monitor.get(sessionId).state, "ok");
  const identity = await owned.identity();
  monitor.setSessions([]);
  assert.equal(monitor.get(sessionId).state, "stopped");
  await observeProcesses(owned.fixture, [identity.pid, identity.child, identity.daemon], { gone: true });
  const opens = owned.opens;
  for (let i = 0; i < 3; i++) {
    monitor.focus(sessionId, true);
    monitor.refresh(sessionId);
    assert(monitor.history(owned.id).machine.length > 0);
  }
  assert.equal(owned.opens, opens, "Historical focus/refresh must not acquire a target connection");
  assert.equal(monitor.get(sessionId).state, "stopped");
  console.log(JSON.stringify({ status: "PASS", mode, realMonitor: true, historicalFocusDoesNotWake: true, opens, identity }));
} finally {
  await monitor.close();
  await owned.close();
  await rm(home, { recursive: true, force: true });
}
