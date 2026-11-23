import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createTargetEnvironments } from "../../src/target-environment/connection/assemble-environments.ts";
import { createPtyTerminals } from "../../src/workspace/pty-terminals/assemble-terminals.ts";
import { DEFAULT_WORKSPACE_OPTIONS } from "../../src/config/workspace/workspace-options.ts";
import { createModelBashCommand } from "../../src/workspace/terminals/shell/model-bash.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../src/config/terminal/terminal-options.ts";

const mode = process.argv[2];
assert.ok(["local", "office"].includes(mode));
const ssh = process.env.PI_TEST_SSH;
assert.ok(mode === "local" || ssh, "PI_TEST_SSH required for office");
const localRoot = await mkdtemp(join(tmpdir(), "prk-S3-"));
const root = mode === "local" ? localRoot : `/tmp/prk-S3-${randomUUID()}`;
const quote = (s) => `'${s.replaceAll("'", "'\\''")}'`;
function observe(script) {
  const result = spawnSync("/bin/sh", mode === "local" ? [] : ["-c", ssh], { input: script, encoding: "utf8", timeout: 20000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
process.env.HOME = localRoot;
process.env.PRK_HOME = join(localRoot, "prk");
process.env.PRK_SOCKET = join(localRoot, "g.sock");
delete process.env.JUPYTER_URL; delete process.env.JUPYTER_TOKEN;
await mkdir(process.env.PRK_HOME);
observe(`mkdir -p ${quote(root)}; printf '%s\n' 'export S3_LOGIN=owned' > ${quote(`${root}/.bash_profile`)}\n`);
const leases = [];
const events = [];
const environments = createTargetEnvironments({
  resolve: () => mode === "local" ? { local: true } : { local: false, command: `${ssh} ${quote(`HOME=${quote(root)} exec /bin/bash`)}` },
  onEvent: (_, event) => { events.push(event); console.log(JSON.stringify({ event })); },
});
const cleanupUnknown = [];
const terminals = createPtyTerminals({
  workspace: { ...DEFAULT_WORKSPACE_OPTIONS, terminalInputBytes: 512, terminalStartTimeoutMs: 5000, terminalCloseTimeoutMs: 3000, terminalsPerWorkerMax: 2 },
  runtime: async () => { const python = mode === "local" ? process.env.PI_TEST_PYTHON ?? "/usr/bin/python3" : "/usr/bin/python3"; return { python, basePython: python, env: {} }; },
  ownerTarget: (id) => ["a", "b"].includes(id) ? "owned" : undefined,
  acquire: async (id) => { const lease = await environments.acquire(id); leases.push(lease); return lease; },
  onCleanupUnknown: (error, sessionId, name) => cleanupUnknown.push({ message: String(error), sessionId, name }),
});
const outputs = new Map();
const subscriptions = [];
async function until(predicate, label) {
  for (let i = 0; i < 250; i++) { if (predicate()) return; await delay(20); }
  throw new Error(`Timeout ${label}: ${JSON.stringify([...outputs])}`);
}
function attach(session, name) {
  const key = `${session}/${name}`;
  const subscription = terminals.subscribe(session, name, (event) => {
    console.log(JSON.stringify({ session, name, event }));
    if (event.type === "stdout") outputs.set(key, (outputs.get(key) ?? "") + event.data);
  });
  outputs.set(key, subscription.snapshot.replay);
  subscriptions.push(subscription);
  return subscription;
}
const pids = [];
try {
  const pending = terminals.open("a", { cwd: root }, "human");
  const repeated = terminals.open("a", { cwd: root }, "human");
  const model = terminals.open("a", { cwd: root }, "model", { owner: "model", label: "model", shellCommand: createModelBashCommand(DEFAULT_TERMINAL_OPTIONS.modelHistoryFile) });
  await assert.rejects(terminals.open("a", { cwd: root }, "over"), (e) => e.code === "BUSY");
  const [one, same, modelSnapshot] = await Promise.all([pending, repeated, model]);
  assert.equal(one.generation, same.generation);
  assert.equal(leases.length, 2, "singleflight owns one lease per terminal");
  assert.equal(modelSnapshot.owner, "model");
  await terminals.open("b", { cwd: root }, "human");
  assert.notEqual(terminals.list("b").terminals[0].generation, one.generation);
  for (const [session, name] of [["a", "human"], ["a", "model"], ["b", "human"]]) {
    attach(session, name);
    assert.equal(await terminals.integration(session, name), "ready");
    const command = 'printf "S3_PID=%s ENV=%s/%s LOGIN=%s\\n" "$$" "$TERM" "$COLORTERM" "${S3_LOGIN-unset}"\r';
    console.log(JSON.stringify({ input: command, session, name }));
    terminals.input(session, name, command);
    await until(() => /S3_PID=\d+ ENV=xterm-256color\/truecolor/u.test(outputs.get(`${session}/${name}`)), "shell identity");
    pids.push(Number(outputs.get(`${session}/${name}`).match(/S3_PID=(\d+) ENV=/u)[1]));
  }
  if (process.argv[3] === "disconnect") {
    const spawn = events.find((event) => event.kind === "spawn");
    assert.ok(spawn?.wrapperPid);
    console.log(JSON.stringify({ killedOwnedWrapper: spawn.wrapperPid, oldGeneration: one.generation }));
    process.kill(spawn.wrapperPid, "SIGTERM");
    await until(() => !terminals.list("a").terminals.length && !terminals.list("b").terminals.length, "connection retirement");
    assert.throws(() => terminals.input("a", "human", "NEVER_REPLAY\r"), (error) => error.code === "UNAVAILABLE");
    assert.throws(() => terminals.subscribe("a", "human", () => {}), (error) => error.code === "NOT_FOUND");
    await delay(200);
    assert.equal(events.filter((event) => event.kind === "spawn").length, 1, "observation cannot reconnect");
    const fresh = await terminals.open("a", { cwd: root }, "human");
    assert.notEqual(fresh.generation, one.generation);
    attach("a", "human");
    terminals.input("a", "human", 'printf "NEW_PID=%s\\n" "$$"\r');
    await until(() => /NEW_PID=\d+/u.test(outputs.get("a/human")), "explicit new shell");
    pids.push(Number(outputs.get("a/human").match(/NEW_PID=(\d+)/u)[1]));
    assert(!outputs.get("a/human").includes("NEVER_REPLAY"));
    console.log(JSON.stringify({ mode, evidence: "disconnect-no-recovery-pass", newGeneration: fresh.generation }));
  } else {
  assert.match(outputs.get("a/human"), /LOGIN=owned/u);
  assert.throws(() => terminals.input("a", "human", "β".repeat(257)), (e) => e.code === "TOO_LARGE");
  terminals.resize("a", "human", 31, 97);
  terminals.input("a", "human", "stty size; printf 'UNI=%s\\n' 'β😀'\r");
  await until(() => outputs.get("a/human").includes("31 97\r\n") && outputs.get("a/human").includes("UNI=β😀\r\n"), "resize and Unicode");
  const old = subscriptions[0]; old.unsubscribe();
  terminals.input("a", "human", "printf 'DETACHED_%s\\n' 'OUTPUT'\r");
  await delay(100);
  const reattached = attach("a", "human");
  assert.equal(reattached.snapshot.generation, one.generation);
  assert.match(reattached.snapshot.replay, /DETACHED_OUTPUT/u);
  terminals.input("a", "human", "read -r answer; printf 'ANSWER=%s\\n' \"$answer\"\r");
  await delay(100); terminals.input("a", "human", "yesβ\r");
  await until(() => outputs.get("a/human").includes("ANSWER=yesβ\r\n"), "interactive input");
  terminals.input("a", "human", "sleep 30\r");
  await delay(100); terminals.input("a", "human", "\x03");
  terminals.input("a", "human", "printf 'CTRL_%s\\n' 'OK'\r");
  await until(() => outputs.get("a/human").includes("CTRL_OK\r\n"), "Ctrl-C keeps shell");
  console.log(JSON.stringify({ mode, root, pids, generation: one.generation, evidence: "noncleanup-input-pass" }));
  }
} finally {
  for (const [session, name] of [["a", "human"], ["a", "model"], ["b", "human"]]) {
    if (terminals.has(session, name)) terminals.input(session, name, "exit\r");
  }
  await until(() => !terminals.list("a").terminals.length && !terminals.list("b").terminals.length, "natural shell exits");
  await Promise.all(leases.map((lease) => lease.release()));
  for (const subscription of subscriptions) subscription.unsubscribe();
  const remaining = observe(`for p in ${pids.join(" ")}; do test ! -e /proc/$p/stat || printf '%s\\n' "$p"; done\n`);
  assert.equal(remaining, "", "independent observer sees recorded shell PIDs absent");
  console.log(JSON.stringify({ cleanupUnknown, observedShellPidsAbsent: pids }));
}
