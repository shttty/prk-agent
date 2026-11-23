import assert from "node:assert/strict";
import test from "node:test";
import { commandLine } from "../../../../src/workspace/model-terminals/commands/command-line.ts";
import { snapshot } from "../../../../src/workspace/model-terminals/output/get-snapshot.ts";
import { begin } from "../../../../src/workspace/model-terminals/commands/begin-command.ts";
import { osc } from "../../../../src/workspace/model-terminals/commands/handle-shell-marker.ts";
import { subscribeState } from "../../../../src/workspace/model-terminals/notifications/subscribe-state.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../../../src/config/terminal/terminal-options.ts";
import xterm from "@xterm/headless";

function context(entries) {
  const terminals = entries.map(({ name, owner }) => ({ name, generation: `generation-${name}`, connectionStatus: "connected", ...(owner === "model" ? { owner } : {}) }));
  return { sessionId: "session-a", entries: new Map(entries.map((entry) => [entry.name, entry])),
    terminals: { list: (id) => { assert.equal(id, "session-a"); return { terminals }; } },
    stateListeners: new Set(), listeners: new Set(), options: DEFAULT_TERMINAL_OPTIONS, history: new Map(), historyBytes: 0 };
}

test("command labels use the first nonempty line and bound Unicode without splitting a pair", () => {
  assert.equal(commandLine("\r\n  \t\n  echo first  \r\nsecond"), "echo first");
  assert.equal(commandLine(" \n\r\t"), "");
  assert.equal(commandLine("x".repeat(160)), "x".repeat(160));
  assert.equal(commandLine("x".repeat(161)), `${"x".repeat(159)}…`);
  assert.equal(commandLine(`${"x".repeat(158)}🙂tail`), `${"x".repeat(158)}…`);
  assert.equal(commandLine(`${"x".repeat(157)}🙂tail`), `${"x".repeat(157)}🙂…`);
});

test("snapshots expose only running model-issued commands in model terminals", () => {
  const command = { id: "command-a", text: "\n echo first\nsecret second line", started: 123, status: "running", model: true };
  const entries = [
    { name: "model", owner: "model", current: command },
    { name: "human", owner: "human", current: command },
    { name: "manual", owner: "model", current: { ...command, model: false } },
    { name: "done", owner: "model", current: { ...command, status: "done" } },
    { name: "closed", owner: "model", closed: true, current: command },
  ];
  const ctx = context(entries);
  const result = snapshot(ctx);
  assert.deepEqual(result[0].runningCommand, { id: "command-a", text: "echo first", startedAt: 123 });
  assert.equal(result[0].generation, "generation-model");
  assert.equal(JSON.stringify(result).includes("secret"), false);
  for (const terminal of result.slice(1)) assert.equal(Object.hasOwn(terminal, "runningCommand"), false);
  command.status = "done";
  assert.equal(Object.hasOwn(snapshot(ctx)[0], "runningCommand"), false);
});

test("command start and shell completion publish replacement state independently of model notices", () => {
  const terminal = new xterm.Terminal({ allowProposedApi: true });
  const entry = { name: "model", owner: "model", terminal, cwd: "/", integration: "ready", promptColumn: 0, resolveReady() {} };
  const ctx = context([entry]);
  const states = [];
  const unsubscribe = subscribeState(ctx, (terminals) => states.push(terminals));
  try {
    const command = begin(ctx, entry, "sleep 30", true);
    assert.deepEqual(states[0][0].runningCommand, { id: command.id, text: "sleep 30", startedAt: command.started });
    assert.deepEqual(ctx.listeners.size, 0);
    osc(ctx, entry, "C");
    osc(ctx, entry, "D;130");
    assert.equal(states.length, 2);
    assert.equal(Object.hasOwn(states[1][0], "runningCommand"), false);
    assert.equal(states[0][0].runningCommand.id, command.id, "later completion does not mutate an already published snapshot");
    unsubscribe();
    begin(ctx, entry, "next", true);
    assert.equal(states.length, 2);
  } finally { terminal.dispose(); }
});
