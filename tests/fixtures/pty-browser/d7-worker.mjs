import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { openTerminal } from "@earendil-works/pi-env";
import { createTargetEnvironments } from "../../../src/target-environment/connection/assemble-environments.ts";
import { createPtyTerminals } from "../../../src/workspace/pty-terminals/assemble-terminals.ts";
import { createModelTerminals } from "../../../src/workspace/model-terminals/create-terminals.ts";
import { DEFAULT_WORKSPACE_OPTIONS } from "../../../src/config/workspace/workspace-options.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../../src/config/terminal/terminal-options.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../../src/config/limits/limits-options.ts";
import { HUMAN_BASH_COMMAND } from "../../../src/workspace/terminals/shell/human-bash.ts";
import { createModelBashCommand } from "../../../src/workspace/terminals/shell/model-bash.ts";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";

const { root, localRoot, command, python } = JSON.parse(process.env.S3_D7_CONFIG);
const sessionId = SessionManager.inMemory(localRoot).getSessionId();
const events = [];
const environments = createTargetEnvironments({ resolve: () => command ? { local: false, command } : { local: true }, onEvent: (_, event) => { events.push(event); process.send({ event }); } });
const terminals = createPtyTerminals({ workspace: DEFAULT_WORKSPACE_OPTIONS, runtime: async () => ({ python, basePython: python, env: {} }), ownerTarget: (id) => id === sessionId ? "owned" : undefined,
  acquire: (id) => environments.acquire(id), onCleanupUnknown: (error) => process.send({ cleanupUnknown: String(error) }) });
const model = createModelTerminals({ sessionId, context: { cwd: root }, terminals, options: { ...DEFAULT_TERMINAL_OPTIONS, yieldMs: 0, quietLadderMs: [100, 300] }, limits: DEFAULT_LIMITS_OPTIONS });
const notices = [];
model.subscribe((notice) => notices.push(notice));
const listener = await startGateway({ close: () => terminals.shutdown() }, `${localRoot}/g.sock`);
async function until(read, label) {
  for (let n = 0; n < 1000; n++) { const result = await read(); if (result) return result; await delay(20); }
  throw new Error(`D7 timeout: ${label}`);
}
async function open(name, owner = "human") {
  const snapshot = await terminals.open(sessionId, { cwd: root }, name, owner === "model" ? { owner, label: name, shellCommand: createModelBashCommand(DEFAULT_TERMINAL_OPTIONS.modelHistoryFile) } : undefined);
  assert.equal(snapshot.cleanup, "linux-pdeathsig");
  const integration = await terminals.integration(sessionId, name);
  const initial = terminals.subscribe(sessionId, name, () => {}); initial.unsubscribe();
  assert.equal(integration, "ready", JSON.stringify(initial.snapshot));
  let output = "";
  const sub = terminals.subscribe(sessionId, name, (event) => { if (event.type === "stdout") output += event.data; });
  terminals.input(sessionId, name, "sleep 600 & ordinary=$!; nohup sleep 600 >/dev/null 2>&1 & detached=$!; sleep 600 & marked=$!; disown -h %+; printf '\\nD7IDS %s %s %s %s %s\\n' \"$$\" \"$PPID\" \"$ordinary\" \"$detached\" \"$marked\"; shopt -p login_shell huponexit\r");
  const match = await until(() => /\r?\nD7IDS (\d+) (\d+) (\d+) (\d+) (\d+)\r?\n/.exec(output), "shell/job identities");
  await until(() => output.includes("shopt -s huponexit") && output.includes("shopt -s login_shell"), "native login and huponexit");
  sub.unsubscribe();
  return { name, owner, generation: snapshot.generation, pids: match.slice(1).map(Number), output };
}
async function modelChecks() {
  const first = await model.send({ name: "commands", text: "printf '模型UTF8\\n'; false", yield_s: 1 });
  assert.equal(first.status, "done"); assert.equal(first.exit_code, 1); assert.match(first.output, /模型UTF8/);
  const before = terminals.list(sessionId).terminals.find((entry) => entry.name === "commands").generation;
  const running = await model.send({ name: "commands", text: "trap '' INT; while :; do sleep 1; done", timeout_s: 0.2, yield_s: 0 });
  const killed = await until(async () => { const value = await model.read({ name: "commands", command: running.command_id, yield_s: 0 }); return value.status === "killed" && value; }, "confirmed hard-timeout rebuild");
  const after = terminals.list(sessionId).terminals.find((entry) => entry.name === "commands").generation;
  assert.notEqual(after, before);
  const next = await model.send({ name: "commands", text: "printf 'AFTER_REBUILD\\n'", yield_s: 1 });
  assert.equal(next.status, "done"); assert.match(next.output, /AFTER_REBUILD/);
  await model.close("commands");
  return { first, killed, before, after, next, notices };
}
async function naturalStatus(owner) {
  const lease = await environments.acquire("owned");
  const source = await readFile(new URL("../../../src/workspace/pty-terminals/run-shell.py", import.meta.url), "utf8");
  let output = "";
  let terminal;
  try {
    terminal = await openTerminal(lease.connection, { cwd: root, rows: 24, cols: 80, argv: [python, "-u", "-c", source, "exit-status", ...(owner === "human" ? HUMAN_BASH_COMMAND : createModelBashCommand(DEFAULT_TERMINAL_OPTIONS.modelHistoryFile))], env: { TERM: "xterm-256color", COLORTERM: "truecolor" }, onData: (bytes) => output += Buffer.from(bytes).toString() });
    await until(() => output.includes("\x1b]133;B\x07"), "native shell prompt");
    terminal.write(new TextEncoder().encode("exit 37\r"));
    const code = await terminal.exited;
    assert.equal(code, 37);
    return { owner, code, output };
  } finally { terminal?.close(); await lease.release(); }
}
process.on("message", async ({ id, method, args = [] }) => {
  try {
    let result;
    if (method === "open") result = await open(...args);
    else if (method === "close") result = await terminals.close(sessionId, args[0]);
    else if (method === "exit") { terminals.input(sessionId, args[0], "exit 37\r"); await until(() => !terminals.has(sessionId, args[0]), "natural retirement"); result = true; }
    else if (method === "closeSession") { await terminals.closeSession(sessionId); result = terminals.list(sessionId); }
    else if (method === "disconnect") { const event = events.findLast((value) => value.kind === "spawn"); process.kill(event.wrapperPid, "SIGKILL"); await until(() => !terminals.list(sessionId).terminals.length, "disconnected retirement"); result = event; }
    else if (method === "model") result = await modelChecks();
    else if (method === "naturalStatus") result = await naturalStatus(...args);
    else if (method === "shutdown") { await terminals.shutdown(); result = terminals.list(sessionId); }
    else if (method === "stop") { await listener.close(); process.send({ id, result: true }); process.disconnect(); return; }
    else throw new Error(`Unknown fixture method ${method}`);
    process.send({ id, result });
  } catch (error) { process.send({ id, error: error.stack }); }
});
process.send({ ready: true, sessionId, socket: `${localRoot}/g.sock` });
