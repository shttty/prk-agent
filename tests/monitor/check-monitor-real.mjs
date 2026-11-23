// Real Jupyter Server + real Gateway host + real collector in a hidden terminal whose shell is a noisy zsh.
// No paid model: a faux provider drives kernel_code / write / edit so tool completion events are real.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) throw new Error("Monitor check requires a test-owned Jupyter Server.");
const zsh = "/usr/bin/zsh";
const scratch = await mkdtemp(join(tmpdir(), "prk-monitor-real-"));
// The terminal shell is the user's zsh with an rc that prints banners, JSON-looking lines and a prompt hook,
// like a p10k setup. The collector must still come up clean.
const zdot = join(scratch, "zdot");
await mkdir(zdot);
await writeFile(join(zdot, ".zshrc"), [
  "print 'WELCOME-BANNER'",
  `print '{"t":"machine","bogus":true}'`,
  "PS1='%F{red}p10k> %f'",
  "precmd() { print -P '%F{green}precmd-hook%f' }",
  "",
].join("\n"));
process.env.SHELL = zsh;
process.env.ZDOTDIR = zdot;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error(`Timed out: ${label}`);
    await sleep(50);
  }
}
const git = (cwd, ...args) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, stdio: "ignore" });
/** Only this fixture's collector processes; other Gateway instances may share the machine. */
async function collectorPids() {
  const pids = [];
  for (const entry of await readdir("/proc")) {
    if (!/^\d+$/u.test(entry)) continue;
    const cmdline = await readFile(`/proc/${entry}/cmdline`, "utf8").catch(() => "");
    if (!cmdline.includes("@@PRK-") || !cmdline.includes("python3\0-u\0-c")) continue;
    const environment = await readFile(`/proc/${entry}/environ`, "utf8").catch(() => "");
    if (environment.split("\0").includes(`ZDOTDIR=${zdot}`)) pids.push(Number(entry));
  }
  return pids;
}

try {
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxAssistantMessage, fauxProvider, fauxToolCall } = await import("@earendil-works/pi-ai");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const agentDir = join(scratch, "agent");
  await mkdir(agentDir);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const provider = fauxProvider({ provider: "monitor-real", models: [{ id: "local" }], tokensPerSecond: 10000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const script = new Map();
  provider.setResponses(Array.from({ length: 40 }, () => async (context) => {
    if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("Done.");
    const user = context.messages.findLast((message) => message.role === "user");
    const text = typeof user.content === "string" ? user.content : user.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    const [tool, args] = script.get(text) ?? ["none", {}];
    return tool === "none" ? fauxAssistantMessage("Nothing to do.") : fauxAssistantMessage(fauxToolCall(tool, args), { stopReason: "toolUse" });
  }));
  const prompt = (text, tool, args) => { script.set(text, [tool, args]); return text; };

  await withTargetFixture(async ({ config: target, tempRoot, onCleanup }) => {
    const home = await mkdtemp(join(tmpdir(), "prk-monitor-home-"));
    onCleanup(() => rm(home, { recursive: true, force: true }));
    const repo = join(tempRoot, "repo");
    const plain = join(tempRoot, "plain");
    await mkdir(repo);
    await mkdir(plain);
    git(repo, "init", "-q", ".");
    await writeFile(join(repo, "base.txt"), "one\ntwo\n");
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "init");
    const targetConfig = { id: "real", label: "Real", local: true, tags: [], kernel: { ...target, cwd: home } };
    const monitorOptions = { slowIntervalMs: 60000, fastIntervalMs: 300, focusLeaseMs: 30000, refreshDebounceMs: 50, startTimeoutMs: 20000 };
    const open = async (extra = {}) => {
      const host = await createGatewayHost({
        cwd: home, home, historyDir: join(home, `history-${Math.random().toString(16).slice(2)}`), model: "monitor-real/local", thinkingLevel: "off", targets: [targetConfig],
        config: parsePrkConfig({ session: { workerTools: "direct", localTools: true, noExtensions: true, ...extra.session }, workspace: { terminalsPerWorkerMax: 2 }, monitor: { ...monitorOptions, ...extra.monitor } }),
      }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir } });
      onCleanup(() => host.close());
      return host;
    };
    const upstream = async () => (await (await fetch(new URL("api/terminals", target.url), { headers: { Authorization: `token ${target.token}` } })).json()).filter((terminal) => terminal.name.startsWith("prkmon_"));
    const run = async (host, name, text) => {
      const submitted = await host.session(name).submit({ requestId: `r-${Math.random().toString(16).slice(2)}`, message: text });
      assert(submitted.accepted);
      assert.equal((await submitted.completion).status, "completed");
    };

    const host = await open();
    const worker = (await host.createSession({ target: "real", cwd: repo })).session.sessionId;
    const other = (await host.createSession({ target: "real", cwd: plain })).session.sessionId;
    const monitorOf = (name) => host.workbench().sessions.find((entry) => entry.sessionId === name)?.monitor;

    // ---- the hidden collector terminal: one per machine, shared, invisible to the user's terminals and cap
    await until(() => monitorOf(worker)?.state === "ok" && monitorOf(worker).changes, "collector up behind a noisy zsh");
    assert.equal(monitorOf(worker).changes.source, "git");
    assert.deepEqual([monitorOf(worker).changes.added, monitorOf(worker).changes.removed], [0, 0]);
    assert.equal((await upstream()).length, 1, "two sessions on one target share one hidden terminal");
    assert.deepEqual(await host.workspace("terminalsList", worker, {}), { terminals: [] }, "not in the user's terminal list");
    await host.workspace("terminalOpen", worker, { name: "a" });
    await host.workspace("terminalOpen", worker, { name: "b" });
    assert.equal((await host.workspace("terminalsList", worker, {})).terminals.length, 2, "and not counted against the user's terminal cap");
    const pids = await collectorPids();
    assert.equal(pids.length, 1, "All sessions collect through their target's one shared Jupyter terminal");
    for (const pid of pids) {
      const stat = await readFile(`/proc/${pid}/stat`, "utf8");
      const parent = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
      const parentCmd = (await readFile(`/proc/${parent}/cmdline`, "utf8").catch(() => "")).replaceAll("\0", " ");
      assert(!/zsh|bash|sh /u.test(parentCmd.split(" ")[0] ?? ""), `collector ${pid} replaced its shell instead of running under it (parent: ${parentCmd})`);
    }
    await until(() => monitorOf(other)?.machine, "second session target machine numbers");
    assert(monitorOf(other).machine.cpu.cores > 0 && monitorOf(other).machine.mem.total > 0);

    // ---- external git edits refresh on tool completion; card focus only changes telemetry cadence
    await writeFile(join(repo, "base.txt"), "one\nTWO\n");
    await writeFile(join(repo, "new.txt"), "a\nb\nc\n");
    await host.monitorFocus(worker, true);
    await run(host, worker, prompt("observe external edits", "kernel_code", { code: "print('refresh external changes')" }));
    const changed = await until(() => { const c = monitorOf(worker).changes; return c.files.length === 2 && c; }, "external edits seen after tool completion");
    assert.deepEqual([changed.added, changed.removed], [1 + 3, 1]);
    assert.deepEqual(changed.files.map((file) => file.path), ["base.txt", "new.txt"]);
    assert.equal(monitorOf(worker).intervalMs, 300);
    assert(monitorOf(worker).machine.disk.total > 0);
    const diff = await host.monitorDiff(worker, "base.txt");
    assert(diff.kind === "git" && diff.text.includes("-two") && diff.text.includes("+TWO"));

    // ---- a finished tool refreshes at once, even on the slow cadence
    await host.monitorFocus(worker, false);
    await until(() => monitorOf(worker).intervalMs === 60000, "back to the slow cadence");
    await sleep(500);
    const slowTick = monitorOf(worker).changes.ageMs;
    await run(host, worker, prompt("write a file", "kernel_code", { code: `open(${JSON.stringify(join(repo, "agent.txt"))}, "w").write("x\\ny\\n")`, title: "write" }));
    await until(() => monitorOf(worker).changes.files.some((file) => file.path === "agent.txt"), "refresh right after the tool ended", 5000);
    assert(monitorOf(worker).changes.ageMs < slowTick + 5000);

    // ---- a busy kernel does not stop collection
    await host.monitorFocus(worker, true);
    const longRun = run(host, worker, prompt("long cell", "kernel_code", { code: "import time\ntime.sleep(6)", title: "sleep" }));
    await until(() => host.state(worker).kernel?.state === "busy", "kernel busy");
    await writeFile(join(repo, "during.txt"), "d\n");
    const sampledAt = Date.now() - monitorOf(worker).machine.ageMs;
    await until(() => Date.now() - monitorOf(worker).machine.ageMs > sampledAt, "machine telemetry advances while the cell runs", 4000);
    assert.equal(host.state(worker).kernel.state, "busy", "still inside the long cell");
    await longRun;
    await until(() => monitorOf(worker).changes.files.some((file) => file.path === "during.txt"), "git changes refresh when the cell completes", 4000);

    // ---- no git: the agent's own write/edit history
    await run(host, other, prompt("write note", "write", { path: "note.txt", content: "a\nb\nc\n" }));
    await run(host, other, prompt("edit note", "edit", { path: "note.txt", oldText: "b", newText: "B" }));
    const agent = await until(() => { const c = monitorOf(other)?.changes; return c?.source === "agent" && c.files[0]?.added === 4 && c; }, "agent-written files as the source");
    assert.deepEqual(agent.files.map((file) => [file.path, file.added, file.removed]), [["note.txt", 4, 1]]);
    const agentDiff = await host.monitorDiff(other, "note.txt");
    assert(agentDiff.kind === "agent" && /^\+ *\d+ B$/mu.test(agentDiff.text) && /^- *\d+ b$/mu.test(agentDiff.text), agentDiff.text);

    // ---- no awake session left on the machine: collector gone, terminal gone, last numbers kept
    await host.closeSession(worker);
    await host.closeSession(other);
    await until(async () => (await upstream()).length === 0 && (await collectorPids()).length === 0, "collectors and hidden terminal removed");
    assert.equal(monitorOf(worker).state, "stopped");
    assert(monitorOf(worker).changes.files.some((file) => file.path === "agent.txt"), "last known changes stay after stopping");
    await host.close();

    // ---- idle sleep stops collection; waking restarts it
    const sleepy = await open({ session: { idleTimeoutMs: 1500, idleCheckIntervalMs: 200 } });
    const napper = (await sleepy.createSession({ target: "real", cwd: repo })).session.sessionId;
    const napping = () => sleepy.workbench().sessions.find((entry) => entry.sessionId === napper);
    await until(() => napping().monitor?.state === "ok" && napping().monitor.changes, "collector up for the sleepy session");
    await until(() => napping().state === "sleeping", "idle sleep", 15000);
    await until(async () => (await upstream()).length === 0 && (await collectorPids()).length === 0, "sleeping sessions are not sampled");
    assert.equal(napping().monitor.state, "stopped");
    assert(napping().monitor.changes.ageMs >= 0, "the last values stay with their age");
    await sleepy.wakeSession(napper);
    await until(() => napping().monitor.state === "ok", "wake restarts collection");
    await sleepy.close();
    await until(async () => (await collectorPids()).length === 0, "Gateway close leaves no collector behind");

    // ---- closing right after a worker appeared does not wait for the collector start (slow shell, handshake pending)
    const hasty = await open();
    await hasty.createSession({ target: "real", cwd: repo });
    const closeStarted = Date.now();
    await hasty.close();
    assert(Date.now() - closeStarted < 8000, `Gateway close waited ${Date.now() - closeStarted} ms for a collector that was still starting`);
    await until(async () => (await upstream()).length === 0 && (await collectorPids()).length === 0, "an aborted start leaves no terminal and no collector");
    console.log("PASS real Jupyter: hidden terminal, noisy zsh, numbers, refresh, busy kernel, agent source, sleep");
  });
} finally {
  await rm(scratch, { recursive: true, force: true });
}
