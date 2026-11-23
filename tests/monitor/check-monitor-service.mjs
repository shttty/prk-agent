import { fakeFleet } from "./service/create-fleet.mjs";
// MonitorService against a scripted fake collector pipe: delivery, cadence, refresh, sleep, version mismatch,
// failed-generation retirement without background reconnect, kernel alerts, diff.
import assert from "node:assert/strict";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { TARGET_CHANNEL_VERSION } from "../../src/target-channel/deployment-source/assemble-runtime-source.ts";
import { createMonitorService } from "../../src/monitor/session-monitor/assemble-session-monitor.ts";
import { DEFAULT_MONITOR_OPTIONS } from "../../src/config/monitor/monitor-options.ts";

const options = {
  ...DEFAULT_MONITOR_OPTIONS,
  slowIntervalMs: 10000, fastIntervalMs: 5000, focusLeaseMs: 150, refreshDebounceMs: 20,
  startTimeoutMs: 500,
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, timeoutMs = 3000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() > end) throw new Error(`Timed out: ${label}`);
    await sleep(5);
  }
}

/** One scripted machine: every open() takes the next behavior; the default is a healthy collector. */

function build(fleet, overrides = {}) {
  const published = [];
  const agent = { calls: 0, result: { added: 4, removed: 1, files: [{ path: "a.py", status: "M", added: 4, removed: 1, binary: false }] } };
  const effective = { ...options, ...overrides };
  const channels = createTargetChannels({ options: { startTimeoutMs: effective.startTimeoutMs }, open: fleet.open });
  const service = createMonitorService({
    options: effective, channels,
    agentChanges: () => { agent.calls++; return agent.result; },
    agentDiff: (_name, path) => `agent diff of ${path}`,
  });
  service.subscribe((name, monitor) => published.push([name, monitor]));
  return { service, published, agent, channels };
}
const dirMessage = (overrides = {}) => ({
  t: "dir", dir: "/w", git: true, added: 3, removed: 1, truncated: false, error: null, reason: null, unavailable: false,
  disk: { total: 1000, free: 400 }, files: [{ path: "x.py", status: "M", added: 3, removed: 1, binary: false }], ...overrides,
});
const machineMessage = () => ({ t: "machine", cpu: { pct: 12.5, cores: 4 }, load: [1, 2, 3], mem: { total: 100, available: 50 }, disk: { total: 5000, free: 2500 }, gpus: [] });
const session = (sessionId, machine = "t1", cwd = "/w") => ({ sessionId, machine, cwd });

// ---- delivery, data, cadence, refresh, sleep
{
  const fleet = fakeFleet();
  const { service, published, agent } = build(fleet);
  service.setSessions([session("a"), session("b")]);
  assert.equal(service.get("a").state, "starting");
  await until(() => service.get("a").state === "ok", "collector hello");
  const pipe = fleet.opens[0];
  assert.equal(fleet.opens.length, 1, "two sessions on one machine share one collector");
  await until(() => pipe.commands.some((command) => command.op === "watch"), "watch sent");
  assert.deepEqual(pipe.commands.find((command) => command.op === "watch").dirs, ["/w"], "one watched entry per distinct cwd");

  pipe.emit(machineMessage());
  pipe.emit(dirMessage());
  await until(() => service.get("b").changes, "changes arrive");
  for (const name of ["a", "b"]) {
    const monitor = service.get(name);
    assert.deepEqual([monitor.changes.source, monitor.changes.added, monitor.changes.removed, monitor.changes.files.length], ["git", 3, 1, 1]);
    assert.equal(monitor.machine.cpu.pct, 12.5);
    assert.deepEqual(monitor.machine.disk, { total: 1000, free: 400 }, "the card shows the disk of the session cwd");
    assert(monitor.changes.ageMs >= 0);
    assert.equal(monitor.intervalMs, 10000);
  }

  // slow -> fast -> slow
  service.focus("a", true);
  await until(() => pipe.commands.at(-1).intervalMs === 5000, "fast interval sent");
  assert.equal(service.get("b").intervalMs, 5000, "the interval belongs to the machine, not the session");
  await until(() => pipe.commands.at(-1).intervalMs === 10000, "lease expiry returns to slow", 1500);
  service.focus("a", true);
  await until(() => pipe.commands.at(-1).intervalMs === 5000, "reopened");
  service.focus("a", false);
  await until(() => pipe.commands.at(-1).intervalMs === 10000, "closing the card returns to slow immediately");

  // a finished tool refreshes this session's cwd once, however many tools finish in the window
  const before = pipe.commands.length;
  service.refresh("a"); service.refresh("a"); service.refresh("a");
  await until(() => pipe.commands.slice(before).some((command) => command.op === "refresh"), "refresh sent");
  await sleep(60);
  assert.deepEqual(pipe.commands.slice(before).filter((command) => command.op === "refresh"), [{ op: "refresh", dir: "/w" }]);

  // no git (git itself says so): the agent's own write/edit history is the source, and the reason travels with it
  pipe.emit(dirMessage({ git: false, added: 0, removed: 0, files: [], reason: "fatal: not a git repository (or any of the parent directories): .git", unavailable: false }));
  await until(() => service.get("a").changes?.source === "agent", "agent source");
  assert.deepEqual([service.get("a").changes.added, service.get("a").changes.removed], [4, 1]);
  assert.deepEqual([service.get("a").changes.gitUnavailable, /not a git repository/.test(service.get("a").changes.gitReason)], [false, true]);
  pipe.emit(dirMessage({ git: false, added: 0, removed: 0, files: [], reason: "fatal: detected dubious ownership in repository at '/w'", unavailable: true }));
  await until(() => service.get("a").changes?.gitUnavailable === true, "git unavailable is reported");
  assert.match(service.get("a").changes.gitReason, /dubious ownership/);
  // a finished tool still asks the collector (git may have been initialised since); its reply recomputes the agent source
  const commandsBefore = pipe.commands.length;
  const callsBefore = agent.calls;
  service.refresh("a");
  await until(() => pipe.commands.length > commandsBefore, "refresh reaches the collector even without git");
  assert.deepEqual(pipe.commands.at(-1), { op: "refresh", dir: "/w" });
  pipe.emit(dirMessage({ git: false, added: 0, removed: 0, files: [], reason: "fatal: not a git repository", unavailable: false }));
  await until(() => agent.calls > callsBefore, "agent changes recomputed from the collector's reply");

  // diff goes through the collector for git, through history for the agent source
  assert.deepEqual(await service.diff("a", "a.py"), { kind: "agent", text: "agent diff of a.py" });
  pipe.emit(dirMessage());
  await until(() => service.get("a").changes?.source === "git", "git again");
  assert.deepEqual(await service.diff("a", "x.py"), { kind: "git", text: "diff of x.py", truncated: false });
  // the tick's disk-only message leaves the git state of the card alone
  const withoutAge = (changes) => ({ ...changes, ageMs: 0 });
  const gitState = withoutAge(service.get("a").changes);
  pipe.emit({ t: "disk", dir: "/w", disk: { total: 1000, free: 250 } });
  await sleep(60);
  assert.deepEqual(withoutAge(service.get("a").changes), gitState, "a disk message does not touch the git state");

  // sleeping: no awake session -> the collector is told to quit and closed, nothing restarts, last values stay
  service.setSessions([]);
  await until(() => pipe.closed, "collector closed");
  assert(pipe.commands.some((command) => command.op === "quit"));
  const asleep = service.get("a");
  assert.equal(asleep.state, "stopped");
  assert.equal(asleep.machine.cpu.pct, 12.5, "the last machine numbers stay visible while asleep");
  assert.equal(asleep.changes.source, "git");
  await sleep(120);
  assert.equal(fleet.opens.length, 1, "a machine without awake sessions is never sampled again");
  assert(published.some(([name, monitor]) => name === "a" && monitor.state === "stopped"));
  service.setSessions([session("a")]);
  await until(() => fleet.opens.length === 2 && service.get("a").state === "ok", "wake starts a fresh collector");
  await service.close();
}

// ---- a version mismatch retires the generation; observation does not reship it
{
  const fleet = fakeFleet([{ version: TARGET_CHANNEL_VERSION + 1 }, {}]);
  const { service } = build(fleet);
  service.setSessions([session("a")]);
  await until(() => service.get("a").state === "error", "version mismatch fails immediately");
  service.focus("a", true);
  service.refresh("a");
  service.setSessions([session("a")]);
  await sleep(300);
  assert.equal(fleet.opens.length, 1, "focus, refresh, unchanged sessions and lease expiry never reconnect");
  assert(fleet.opens[0].closed, "the mismatched collector is closed");
  service.setSessions([session("a"), session("b")]);
  await until(() => service.get("a").state === "ok", "new session admission acquires a fresh generation");
  assert.equal(fleet.opens.length, 2);
  await service.close();
}

// ---- a crash rejects pending work once and old leases never follow a fresh acquire
{
  const fleet = fakeFleet([{ hold: "probe" }, {}]);
  const { service, channels } = build(fleet);
  service.setSessions([session("a")]);
  await until(() => service.get("a").state === "ok", "up before the outage");
  const old = channels.acquire("t1");
  const states = [];
  old.onState(({ state }) => states.push(state));
  const pending = old.request("monitor", "probe").then(() => undefined, (error) => error);
  await until(() => fleet.opens[0].commands.some(({ op }) => op === "probe"), "request was sent before the crash");
  fleet.opens[0].crash("collector process exited (1)");
  assert.match((await pending).message, /collector process exited/);
  assert.equal(service.get("a").state, "error");
  await sleep(300);
  assert.equal(fleet.opens.length, 1, "failed runtime has no automatic restart");
  const fresh = channels.acquire("t1");
  await fresh.request("monitor", "config", { intervalMs: 10000 });
  assert.equal(fleet.opens.length, 2, "only an explicit acquire creates another generation");
  await assert.rejects(old.request("monitor", "config"), /collector process exited/);
  assert.deepEqual(states, ["ok", "error"], "old observers never see the replacement generation");
  assert.equal(fleet.opens[1].commands.some(({ op }) => op === "probe"), false, "unconfirmed request is not replayed");
  await old.release();
  assert.equal(fresh.state().state, "ok", "releasing a failed lease cannot close its replacement");
  await fresh.release();
  await service.close();
}

// ---- kernel alerts come from the existing kernel snapshot
{
  const { service, published } = build(fakeFleet());
  service.setSessions([session("a")]);
  const memory = (current, oomKill = 0) => ({ current, workingSet: current, baseline: 0, extra: current, scope: "s.scope", memoryMax: "4G", memorySwapMax: "0", oomKill });
  const G = 1024 ** 3;
  assert.deepEqual(service.get("a").alerts, { kernel: false, oom: false, memory: false });
  service.reportKernel("a", { state: "idle", memory: memory(3.5 * G) });
  assert.deepEqual(service.get("a").alerts, { kernel: false, oom: false, memory: false }, "87 % of the limit is below the 90 % default");
  service.reportKernel("a", { state: "busy", memory: memory(3.7 * G) });
  assert.equal(service.get("a").alerts.memory, true);
  service.reportKernel("a", { state: "idle", memory: memory(G, 1) });
  assert.deepEqual(service.get("a").alerts, { kernel: false, oom: true, memory: false });
  service.reportKernel("a", { state: "failed" });
  assert.equal(service.get("a").alerts.kernel, true);
  const count = published.length;
  service.reportKernel("a", { state: "failed" });
  assert.equal(published.length, count, "an unchanged alert state publishes nothing");
  service.reportKernel("a", undefined);
  assert.deepEqual(service.get("a").alerts, { kernel: false, oom: false, memory: false });
  await service.close();
}

// ---- stopping while a start is still in flight must not wait for the start (terminal creation / READY handshake)
{
  for (const stage of ["opening", "handshake"]) {
    let aborted = false;
    const open = (_machine, signal) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => { aborted = true; if (stage === "opening") reject(new Error("aborted")); });
      if (stage === "handshake") {
        // a pipe that never says READY: only closing it ends the handshake
        let onClose = () => {};
        resolve({ command: "exec python3\n", transport: { write() {}, onData() {}, onClose: (listener) => { onClose = listener; }, close: async () => { onClose("closed"); } } });
      }
    });
    const opts = { ...options, startTimeoutMs: 60000 };
    const service = createMonitorService({ options: opts, channels: createTargetChannels({ options: { startTimeoutMs: opts.startTimeoutMs }, open }), agentChanges: () => ({ added: 0, removed: 0, files: [] }), agentDiff: () => "" });
    service.setSessions([session("a")]);
    await sleep(30);
    const started = Date.now();
    await service.close();
    assert(Date.now() - started < 1000, `${stage}: close does not wait for the start`);
    assert.equal(aborted, true, `${stage}: the start was told to stop`);
  }
}

// ---- master switch
{
  const fleet = fakeFleet();
  const { service } = build(fleet, { enabled: false });
  service.setSessions([session("a")]);
  await sleep(50);
  assert.equal(fleet.opens.length, 0);
  assert.equal(service.get("a"), undefined);
  await service.close();
}
console.log("PASS monitor service delivery, cadence, refresh, sleep, version, failed lease isolation, no reconnect/replay, alerts");
