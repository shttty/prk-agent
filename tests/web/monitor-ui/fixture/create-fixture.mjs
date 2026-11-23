import { snapshotOf } from "../../../fixtures/workspace-mock/session-snapshots.mjs";

export function createFixture() {
  const G = 1024 ** 3;
  const kernel = (extra = {}) => ({ state: "idle", connectionStatus: "connected", memory: { current: 3.8 * G, workingSet: G, baseline: 0, extra: 3.8 * G, scope: "s.scope", memoryMax: "4G", memorySwapMax: "0", oomKill: 0 }, ...extra });
  const quiet = { kernel: false, oom: false, memory: false };
  const machine = (extra = {}) => ({ cpu: { pct: 12.4, cores: 8 }, load: [0.5, 0.6, 0.7], mem: { total: 16 * G, available: 6 * G }, disk: { total: 500 * G, free: 200 * G }, gpus: [], ageMs: 4000, sampledAt: Date.now() - 4000, ...extra });
  const FILES = [
    { path: "src/app.py", status: "M", added: 10, removed: 3, binary: false },
    { path: "notes.md", status: "?", added: 2, removed: 0, binary: false },
  ];
  const monitor = (extra = {}) => ({ state: "ok", intervalMs: 30000, alerts: quiet, machine: machine(), changes: { source: "git", added: 12, removed: 3, truncated: false, ageMs: 7000, files: FILES }, ...extra });
  const SESSIONS = [
    { label: "worker", sessionId: "w1", state: "idle", target: "alpha", cwd: "/data", kernel: kernel(), monitor: monitor({ alerts: { ...quiet, oom: true } }) },
    { label: "second", sessionId: "w2", state: "idle", target: "alpha", cwd: "/data", kernel: kernel(), monitor: monitor({ changes: { source: "git", added: 0, removed: 0, truncated: false, ageMs: 1000, files: [] } }) },
    { label: "plain", sessionId: "w3", state: "idle", target: "alpha", cwd: "/plain", kernel: kernel(), monitor: monitor({ changes: { source: "agent", added: 4, removed: 1, truncated: false, ageMs: 2000, files: [{ path: "note.txt", status: "M", added: 4, removed: 1, binary: false }] } }) },
    { label: "daily worker", sessionId: "m1", state: "idle", target: "alpha", cwd: "/data", kernel: kernel(), monitor: monitor({ changes: { source: "git", added: 0, removed: 0, truncated: false, ageMs: 1000, files: [] } }) },
    { label: "closed", sessionId: "c1", state: "closed", target: "alpha", cwd: "/data" },
  ];
  const TARGETS = [{ id: "alpha", label: "Monitor target", local: false, sshCommand: "ssh -T monitor", python: "/usr/bin/python3", cwd: "/data" }];
  const SNAPSHOTS = Object.fromEntries(SESSIONS.map((worker) => [worker.sessionId, { ...snapshotOf(worker.sessionId, worker.state), ...(worker.kernel ? { kernel: worker.kernel } : {}) }]));
  const UNIFIED = "diff --git a/src/app.py b/src/app.py\nindex 1..2 100644\n--- a/src/app.py\n+++ b/src/app.py\n@@ -1,3 +1,4 @@\n keep\n-old\n+new\n+added\n tail\n";
  const PI_DIFF = "+1 a\n+2 B\n-2 b\n";

  const calls = [];
  const routes = {
    "/api/sessions/w1/monitor/focus": (body) => { calls.push(["focus", body.open]); return { focused: body.open, leaseMs: 3000 }; },
    "/api/sessions/w1/monitor/diff": (body) => { calls.push(["diff", body.path]); return { kind: "git", text: UNIFIED, truncated: false }; },
    "/api/sessions/w3/monitor/diff": (body) => { calls.push(["diff", body.path]); return { kind: "agent", text: PI_DIFF }; },
    "/api/sessions/w1/kernel/restart": () => { calls.push(["restart"]); return {}; },
    "/api/sessions/w1/kernel/clear": () => { calls.push(["clear"]); return {}; },
  };
  return { G, kernel, quiet, machine, FILES, monitor, SESSIONS, TARGETS, SNAPSHOTS, calls, routes };
}
