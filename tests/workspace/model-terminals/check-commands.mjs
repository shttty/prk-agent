import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

export async function checkTerminalCommands({ call, run, runtime, wakes, consumedResults, until, eventsIn, terminalResult, submissions, text, cwd }) {
  const sequenceResult = await call("terminal_textsend", { text: "seq 1 5000", yield_s: 2 });
  assert.equal(sequenceResult.status, "done");
  assert.equal(sequenceResult.exit_code, 0);
  assert.equal(sequenceResult.truncated, true, "normal result is bounded independently of terminal height");
  let full = "";
  for (let offset = 0; offset < sequenceResult.total_bytes;) {
    const page = await call("terminal_read", { command: sequenceResult.command_id, offset });
    assert.equal(page.command_id, sequenceResult.command_id);
    assert.equal(page.total_bytes, sequenceResult.total_bytes);
    const bytes = Buffer.byteLength(page.output);
    assert(bytes > 0 && bytes <= 2048, "paging makes bounded forward progress");
    full += page.output;
    offset += bytes;
    assert.equal(page.truncated, offset < sequenceResult.total_bytes);
  }
  assert.equal(Buffer.byteLength(full), sequenceResult.total_bytes);
  assert.equal(full.trimEnd(), Array.from({ length: 5000 }, (_, index) => String(index + 1)).join("\n"), "all 5000 lines are recoverable exactly once in order");

  const interactive = await call("terminal_textsend", { text: 'read -p "ok? [y/N] " x; echo got=$x', yield_s: 0 });
  assert.equal(interactive.status, "running");
  assert.equal(interactive.exit_code, null);
  assert.match(interactive.note ?? "", /quiet_notify is off/u);
  assert.equal(runtime.getSnapshot().state, "idle", "the foreground turn finishes before a background event wakes it");
  await new Promise((resolve) => setTimeout(resolve, 2400));
  assert.equal(wakes.some((event) => event.kind === "quiet" && event.result.command_id === interactive.command_id), false, "quiet_notify defaults to false so background running commands do not emit quiet wakes");
  const enabled = JSON.parse(text(await run("terminal_set", { name: "main", quiet_notify: true })));
  assert.deepEqual(enabled, { name: "main", quiet_notify: true, output_brake: true });
  const submissionsBeforeWake = submissions();
  await until(() => runtime.getSnapshot(), (snapshot) => snapshot.state === "idle" && consumedResults.has("quiet-answer") && wakes.some((event) => event.kind === "done" && event.result.command_id === interactive.command_id), "quiet event wakes idle SDK session, model answers y, then done event wakes it again");
  assert.equal(submissions(), submissionsBeforeWake, "no user submission or terminal polling drives the background turns");
  const quiet = wakes.find((event) => event.kind === "quiet" && event.result.command_id === interactive.command_id);
  assert(quiet, "the controlled provider receives the quiet event's structured content");
  terminalResult(quiet.result);
  const answered = terminalResult(JSON.parse(text(consumedResults.get("quiet-answer"))));
  assert.equal(answered.command_id, interactive.command_id, "sending y continues the same running command");
  const completed = wakes.find((event) => event.kind === "done" && event.result.command_id === interactive.command_id);
  terminalResult(completed.result);
  assert.equal(completed.result.status, "done");
  assert.deepEqual([typeof interactive.note, Object.hasOwn(completed.result, "note")], ["string", false], "running results carry a note; done results omit it");
  assert.equal(completed.result.exit_code, 0);
  assert.match(completed.result.output, /got=y/);
  const notices = runtime.getSnapshot().messages.filter((message) => message.role === "custom" && message.customType === "terminal-event");
  assert(notices.length >= 2, "quiet and completion are persisted as real SDK custom messages");
  for (const notice of notices) {
    assert.equal(notice.display, true);
    assert.deepEqual(eventsIn(notice), notice.details.events, "display details and model content describe the same events");
  }

  const ladderCheck = await call("terminal_textsend", { text: "sleep 30", yield_s: 0, quiet_notify: true });
  assert.equal(ladderCheck.status, "running");
  await until(() => wakes.filter((event) => event.kind === "quiet" && event.result.command_id === ladderCheck.command_id), (items) => items.length >= 1 && runtime.getSnapshot().state === "idle", "first quiet event fires at level 0 (250ms) and advances ladder to level 1 (5000ms)");
  assert.deepEqual(JSON.parse(text(await run("terminal_set", { name: "main", quiet_notify: false }))), { name: "main", quiet_notify: false, output_brake: true });
  const quietCountBeforeReenable = wakes.filter((event) => event.kind === "quiet" && event.result.command_id === ladderCheck.command_id).length;
  const reenableAt = Date.now();
  assert.deepEqual(JSON.parse(text(await run("terminal_set", { name: "main", quiet_notify: true }))), { name: "main", quiet_notify: true, output_brake: true });
  await until(() => wakes.filter((event) => event.kind === "quiet" && event.result.command_id === ladderCheck.command_id), (items) => items.length > quietCountBeforeReenable && runtime.getSnapshot().state === "idle", "switching quiet_notify from false to true restarts the ladder from level 0 instead of waiting 5000ms");
  assert(Date.now() - reenableAt < 4500, "re-enabled quiet ladder fired at level 0 (250ms + 2s batch) rather than level 1 (5000ms + 2s batch)");
  assert.deepEqual(JSON.parse(text(await run("terminal_set", { name: "main", quiet_notify: false }))), { name: "main", quiet_notify: false, output_brake: true });
  await call("terminal_keysend", { name: "main", keys: "C-c", yield_s: 2 });

  const foregroundCommand = await call("terminal_textsend", { text: 'read -p "foreground? " x; sleep 0.6; echo foreground=$x', yield_s: 0, quiet_notify: true });
  assert.equal(foregroundCommand.status, "running");
  const foregroundDone = await call("terminal_textsend", { text: "y", yield_s: 2 });
  assert.equal(foregroundDone.command_id, foregroundCommand.command_id);
  assert.equal(foregroundDone.status, "done");
  assert.equal(foregroundDone.exit_code, 0);
  assert.match(foregroundDone.output, /foreground=y/);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const foregroundNotices = runtime.getSnapshot().messages
    .filter((message) => message.role === "custom" && message.customType === "terminal-event")
    .flatMap(eventsIn).filter((event) => event.result.command_id === foregroundCommand.command_id);
  assert.deepEqual(foregroundNotices, [], "foreground completion returns through the tool without quiet or done events, even after the first quiet threshold");

  const timeoutStarted = Date.now();
  const killed = await call("terminal_textsend", { text: "sleep 100", timeout_s: 1, yield_s: 2 });
  assert.equal(killed.status, "killed");
  assert(killed.duration_ms >= 750 && killed.duration_ms < 10_000);
  assert(Date.now() - timeoutStarted < 10_000, "hard timeout interrupts sleep rather than waiting 100 seconds");
  assert.equal((await call("terminal_textsend", { text: "export FOO=1", yield_s: 2 })).status, "done");
  const restarted = await call("terminal_textsend", { text: "echo ${FOO:-unset}", restart: true, yield_s: 2 });
  assert.equal(restarted.status, "done");
  assert.equal(restarted.output.trim(), "unset", "restart replaces the shell and its exported environment");
  const heredocContent = "col1\tcol2\n\tleading-tab\n";
  const assertMultilineTextsend = async (fileName) => {
    const script = [
      "echo line-start",
      `cat <<'EOF' > ${fileName}`,
      heredocContent.trimEnd(),
      "EOF",
      'echo "x!y"',
      "echo line-before-false",
      "false",
    ].join("\n");
    const noticesBefore = runtime.getSnapshot().messages.filter((message) => message.role === "custom" && message.customType === "terminal-event").length;
    const multi = await call("terminal_textsend", { text: script, yield_s: 2 });
    assert.equal(multi.status, "done");
    assert.equal(multi.command, script, "command field retains original unencoded text");
    assert.equal(multi.exit_code, 1);
    assert.equal(multi.output.trim(), "line-start\nx!y\nline-before-false");
    assert.equal(await readFile(join(cwd, fileName), "utf8"), heredocContent, "heredoc file retains literal tabs");
    const latest = await call("terminal_read", {});
    assert.equal(latest.command_id, multi.command_id, "multi-line send produces a single tracked command");
    const noticesAfter = runtime.getSnapshot().messages.filter((message) => message.role === "custom" && message.customType === "terminal-event").length;
    assert.equal(noticesAfter, noticesBefore, "no trailing lines run as untracked background commands");
    await rm(join(cwd, fileName));
  };
  await assertMultilineTextsend("paste-path.txt");
  assert.equal((await call("terminal_textsend", { text: "bind 'set enable-bracketed-paste off'", yield_s: 2 })).exit_code, 0);
  await assertMultilineTextsend("eval-base64-path.txt");
  assert.equal((await call("terminal_textsend", { text: "bind 'set enable-bracketed-paste on'", yield_s: 2 })).exit_code, 0);
  const folded = await call("terminal_textsend", { text: "printf 'repeat-line\\n%.0s' {1..1000}", yield_s: 2 });
  assert.equal(folded.status, "done");
  assert.match(folded.output, /×1000/);
  assert.equal(folded.output.split("\n").filter((line) => line.includes("repeat-line")).length, 1);
  assert.equal(folded.truncated, false, "repeat compression precedes output-byte truncation");
  const raw = await call("terminal_read", { raw: true });
  assert.equal(raw.command_id, folded.command_id);
  assert(raw.output.split("\n").filter((line) => line === "repeat-line").length > 1, "raw returns the visible terminal screen, not folded command output");
  assert.doesNotMatch(raw.output, /×1000/);

  return { sequenceResult, full, folded };
}
