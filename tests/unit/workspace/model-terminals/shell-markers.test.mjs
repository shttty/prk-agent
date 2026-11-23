import assert from "node:assert/strict";
import test from "node:test";
import xterm from "@xterm/headless";
import { begin } from "../../../../src/workspace/model-terminals/commands/begin-command.ts";
import { osc } from "../../../../src/workspace/model-terminals/commands/handle-shell-marker.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../../../src/config/terminal/terminal-options.ts";

test("nested B finishes a running command with null and preserves ordinary D exit codes", () => {
  const terminal = new xterm.Terminal({ allowProposedApi: true });
  const ready = Promise.withResolvers();
  const entry = { name: "shell", owner: "model", integration: "ready", terminal, cwd: "/", promptColumn: 0, resolveReady: ready.resolve };
  const ctx = { history: new Map(), historyBytes: 0, entries: new Map([[entry.name, entry]]), options: DEFAULT_TERMINAL_OPTIONS, listeners: new Set(), stateListeners: new Set() };
  try {
    osc(ctx, entry, "B");
    const login = begin(ctx, entry, "prk_ssh localhost", true);
    osc(ctx, entry, "B");
    assert.equal(login.status, "running", "readline redraw before C is not a nested running shell prompt");
    osc(ctx, entry, "C");
    osc(ctx, entry, "B");
    assert.equal(login.status, "done");
    assert.equal(login.exitCode, null);
    assert.equal(ctx.history.get(login.id), login);
    const next = begin(ctx, entry, "false", true);
    osc(ctx, entry, "C");
    osc(ctx, entry, "D;1");
    osc(ctx, entry, "B");
    assert.equal(next.status, "done");
    assert.equal(next.exitCode, 1, "B after normal D never overwrites the real exit status");
    assert.notEqual(next.id, login.id);
  } finally { terminal.dispose(); }
});
