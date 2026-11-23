import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DEFAULT_LIMITS_OPTIONS } from "../../src/config/limits/limits-options.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../src/config/terminal/terminal-options.ts";
import { DEFAULT_WORKSPACE_OPTIONS } from "../../src/config/workspace/workspace-options.ts";
import { createModelTerminals } from "../../src/workspace/model-terminals/create-terminals.ts";
import { createPtyTerminals } from "../../src/workspace/pty-terminals/assemble-terminals.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

await withTargetFixture(async ({ runtime, tempRoot, onCleanup }) => {
  process.env.HOME = tempRoot;
  process.env.SHELL = "/bin/bash";
  const sessionId = "test";
  const name = "main";
  const command = "printf '%s' SHOULD_NOT_RUN";
  const pty = createPtyTerminals({
    workspace: DEFAULT_WORKSPACE_OPTIONS,
    runtime: async () => ({ python: runtime.python, basePython: runtime.python, env: {} }),
    ownerTarget: () => runtime.target,
    acquire: runtime.acquire,
    onCleanupUnknown(error) { throw error; },
  });
  onCleanup(() => pty.shutdown());
  const terminals = createModelTerminals({
    sessionId,
    context: { sessionId, target: runtime.target, cwd: tempRoot },
    options: { ...DEFAULT_TERMINAL_OPTIONS, modelHistoryFile: join(tempRoot, "history") },
    limits: DEFAULT_LIMITS_OPTIONS,
    terminals: {
      ...pty,
      // Stop delivery just before Enter so the interrupt isn't racing command execution.
      input(id, terminal, data) {
        return pty.input(id, terminal, data.includes(command) ? data.slice(0, -1) : data);
      },
    },
  });
  onCleanup(() => terminals.closeAll());
  await terminals.send({ name, text: "", restart: true });
  let stdout = "";
  const subscription = pty.subscribe(sessionId, name, (event) => {
    if (event.type === "stdout") stdout += event.data;
  });
  onCleanup(() => subscription.unsubscribe());
  const completion = terminals.send({ name, text: command, yield_s: 6 });
  await until(() => stdout.includes(command), "readline displays the pasted command");
  assert(terminals.getSnapshot()[0].runningCommand, "editing does not settle the tracked input");
  assert.doesNotMatch(stdout, /\x1b\]133;[CD][;\x07]/u, "Bash never started the command");
  stdout = "";
  pty.input(sessionId, name, "\x0c");
  await until(() => stdout.includes("\x1b]133;B\x07"), "Ctrl-L only redraws PS1");
  assert.doesNotMatch(stdout, /\x1b\]133;A\x07/u);
  assert.equal((await terminals.read({ name })).status, "running", "a readline-only B must not cancel a pending paste");
  stdout = "";
  pty.input(sessionId, name, "\x03");
  await until(() => stdout.includes("\x1b]133;B\x07"), "Bash redraws its prompt after Ctrl-C");
  assert.match(stdout, /\x1b\]133;A\x07/u, "a fresh prompt reports A via PROMPT_COMMAND");
  assert.doesNotMatch(stdout, /\x1b\]133;[CD][;\x07]/u, "Bash signaled neither command start nor completion");
  const result = await completion;
  assert.equal(result.status, "killed", "readline cleared the command before Bash executed it");
  assert.equal(result.exit_code, null);
  assert.equal(terminals.getSnapshot()[0].runningCommand, undefined);

  // Hold the preceding command's prompt hook between D and A. The next send
  // already owns the tracker when this old A reaches the gateway.
  const gate = join(tempRoot, "allow-prompt");
  const hold = `while [[ ! -e ${JSON.stringify(gate)} ]]; do sleep 0.02; done`;
  const install = `PROMPT_COMMAND=("\${PROMPT_COMMAND[@]:0:1}" '${hold}' "\${PROMPT_COMMAND[@]:1}")`;
  const preceding = await terminals.send({ name, text: install, yield_s: 6 });
  assert.equal(preceding.status, "done");
  const next = terminals.send({ name, text: "printf '%s%s\\n' NEXT_ WORKED", yield_s: 6 });
  try {
    await until(() => terminals.getSnapshot()[0].runningCommand?.text.includes("NEXT_"), "the next send is tracked before the preceding A");
  } finally {
    await writeFile(gate, "");
  }
  const nextResult = await next;
  assert.equal(nextResult.status, "done", "the preceding A must not cancel this input");
  assert.equal(nextResult.exit_code, 0);
  assert.match(nextResult.output, /NEXT_WORKED/u);
});

async function until(predicate, label) {
  const end = Date.now() + 5_000;
  while (!predicate()) {
    assert(Date.now() < end, `Timed out: ${label}`);
    await delay(10);
  }
}
