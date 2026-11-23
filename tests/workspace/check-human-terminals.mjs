import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withTerminalFixture } from "./model-terminals/with-terminal-fixture.mjs";
// The runner may itself export these; prove human rc does not introduce them.
for (const key of ["DEBIAN_FRONTEND", "PIP_NO_INPUT", "PYTHONUNBUFFERED", "GIT_TERMINAL_PROMPT"]) delete process.env[key];

await withTerminalFixture(async ({ call, transport, terminals, notices, until, config, tempRoot, sessionId }) => {
  const profile = join(tempRoot, ".bash_profile");
  await writeFile(profile, `export HUMAN_PROFILE=first\nPS1='HUMAN_PROMPT> '\nPROMPT_COMMAND='printf "PC_PRESERVED\\n"'\ntrap 'printf "DEBUG_PRESERVED\\n"' DEBUG\n`);
  await writeFile(join(tempRoot, ".bash_login"), "export HUMAN_PROFILE=wrong\n");
  await writeFile(join(tempRoot, ".profile"), "export HUMAN_PROFILE=wrong\n");
  await transport.open(sessionId, config, "human");
  const listed = (await call("terminal_list")).terminals.find(({ name }) => name === "human");
  assert.deepEqual(listed, { name: "human", owner: "human", label: "human", integration: "ready" });
  assert.equal((await call("terminal_read", { name: "human", raw: true })).integration, "ready", "read can attach a human tab before any model write");
  const generation = transport.list(sessionId).terminals[0].generation;
  const command = 'printf "ENV=%s|%s|%s|%s|%s\\n" "$BASH_VERSION" "$HUMAN_PROFILE" "$HISTFILE" "$-" "${DEBIAN_FRONTEND-unset}"; false';
  const sent = await call("terminal_textsend", { name: "human", text: command, yield_s: 2, quiet_notify: true });
  assert.equal(sent.status, "done");
  assert.equal(sent.exit_code, 1);
  assert.match(sent.output, /ENV=\d[^|]*\|first\|[^|]*\.bash_history\|[^|]*H[^|]*\|unset/u);
  assert.equal(transport.list(sessionId).terminals[0].generation, generation, "textsend writes to the existing human PTY");
  const raw = await call("terminal_read", { name: "human", raw: true });
  for (const text of ["HUMAN_PROMPT>", "PC_PRESERVED", "DEBUG_PRESERVED"]) assert(raw.output.includes(text), text);
  assert.deepEqual(await call("terminal_set", { name: "human", quiet_notify: false }), { name: "human", quiet_notify: false, output_brake: true });
  const waiting = await call("terminal_textsend", { name: "human", text: "printf 'KEY_%s\\n' READY; sleep 20", yield_s: 0 });
  assert.equal(waiting.status, "running");
  await until(() => call("terminal_read", { name: "human", raw: true }), (r) => r.output.includes("KEY_READY\n"), "foreground sleep actually started");
  const interrupted = await call("terminal_keysend", { name: "human", keys: "C-c", yield_s: 2 });
  assert.equal(interrupted.status, "done");
  assert.equal(interrupted.exit_code, 130);
  const noticeStart = notices.length;
  transport.input(sessionId, "human", "sleep 0.4; printf 'HUMAN_SELF_DONE\\n'\r");
  await until(() => call("terminal_read", { name: "human" }), (r) => r.status === "done" && r.output.includes("HUMAN_SELF_DONE"), "human command completes");
  assert.deepEqual(notices.slice(noticeStart), [], "human commands never send model completion or quiet events");
  // Explicit user-authorized restart is executable; ownership stays human.
  await call("terminal_textsend", { name: "human", text: "", restart: true, yield_s: 1 });
  assert.notEqual(transport.list(sessionId).terminals[0].generation, generation);
  assert.equal((await call("terminal_list")).terminals[0].owner, "human");
  const pidFile = join(tempRoot, "timeout-pid");
  const stuck = await call("terminal_textsend", { name: "human", text: `python3 -c 'import signal,time,os; signal.signal(signal.SIGINT,signal.SIG_IGN); open(${JSON.stringify(pidFile)},"w").write(str(os.getpid())); print("STUCK_READY",flush=True); time.sleep(100)'`, timeout_s: 0.5, yield_s: 0 });
  await until(() => readFile(pidFile, "utf8").catch(() => ""), Boolean, "stuck PID exists");
  const pid = Number(await readFile(pidFile, "utf8"));
  const grace = Promise.withResolvers();
  setTimeout(grace.resolve, 1000);
  await grace.promise;
  const during = await call("terminal_read", { name: "human", command: stuck.command_id });
  assert.equal(during.status, "running", "ignoring Ctrl-C is not a killed command");
  const rebuilt = await until(() => notices, (events) => events.some((event) => event.kind === "done" && event.result.command_id === stuck.command_id), "hard-timeout completion after actual rebuild");
  const done = rebuilt.find((event) => event.kind === "done" && event.result.command_id === stuck.command_id).result;
  assert.equal(done.status, "killed");
  assert.equal(done.note, "人类终端已因硬超时重建");
  assert.throws(() => process.kill(pid, 0), (error) => error.code === "ESRCH", "old process has actually ended");
  assert.equal((await call("terminal_read", { name: "human", command: stuck.command_id })).note, done.note);
  assert.equal((await call("terminal_list")).terminals[0].owner, "human");
  const after = await call("terminal_textsend", { name: "human", text: 'printf "REBUILT=%s\\n" "$HUMAN_PROFILE"', yield_s: 2 });
  assert.equal(after.exit_code, 0);
  assert.match(after.output, /REBUILT=first/u);
  await call("terminal_close", { name: "human" });
  assert.deepEqual((await call("terminal_list")).terminals, []);

  // No B before readiness deadline: keep human screen usable and disclose unavailable.
  await writeFile(profile, "exec /bin/bash --noprofile --norc -i\n");
  await transport.open(sessionId, config, "unmarked");
  const unmarked = (await call("terminal_list")).terminals.find(({ name }) => name === "unmarked");
  assert.equal(unmarked.integration, "unavailable");
  assert.match(unmarked.note, /命令级跟踪不可用/u);
  assert.equal((await call("terminal_read", { name: "unmarked", raw: true })).status, "unavailable");
  await assert.rejects(terminals.send({ name: "unmarked", text: "echo MUST_NOT_RUN", timeout_s: 1 }), (error) => error.code === "UNAVAILABLE");
  for (const value of [await terminals.read({ name: "unmarked", raw: true }), await terminals.send({ name: "unmarked", text: "echo UNMARKED_USABLE", yield_s: 0 }), await terminals.key({ name: "unmarked", keys: "Enter", yield_s: 0 })]) {
    assert.equal(value.status, "unavailable");
    assert.equal(value.command_id, null);
    assert.match(value.note, /命令级跟踪不可用/u);
  }
  assert.match((await terminals.set({ name: "unmarked", quiet_notify: true })).note, /命令级跟踪不可用/u);
  await terminals.closeAll();
  assert.equal(transport.has(sessionId, "unmarked"), true, "model controller shutdown retains human terminals");
  await call("terminal_close", { name: "unmarked" });
  assert.equal(terminals.hasRunning(), false);
  console.log("PASS human terminals: actual registered tools, login bash and hooks/history, human I/O/ownership, explicit restart/close, real hard-timeout rebuild+notice, unmarked integration unavailable");
});
