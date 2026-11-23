import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

// Real Pi/faux, PRK extension hooks/host/UI. Default mode also uses an owned Python REPL.
assert.equal(process.env.JUPYTER_URL, undefined);
assert.equal(process.env.JUPYTER_TOKEN, undefined);
if (process.argv.includes("--host-stop")) {
  const home = await mkdtemp("/tmp/prk-host-stop-");
  const prk = join(home, "prk"), tmp = join(home, "tmp"), agentDir = join(prk, "agent");
  try {
    await Promise.all([mkdir(prk), mkdir(tmp)]);
    Object.assign(process.env, { HOME: home, PRK_HOME: prk, TMPDIR: tmp, XDG_RUNTIME_DIR: tmp,
      PI_CODING_AGENT_DIR: agentDir, PRK_CODING_AGENT_DIR: agentDir });
    const { checkYieldedHostStop } = await import("./fixtures/check-yielded-host-stop.mjs");
    await checkYieldedHostStop(tmp);
  } finally { await rm(home, { recursive: true, force: true }); }
} else await (await import("../fixtures/target-fixture.mjs")).withTargetFixture(async (target) => {
  const { createYieldedSdkCell, text, until, within } = await import("./fixtures/create-yielded-sdk-cell.mjs");
  const { checkSharedCellSettlement } = await import("./fixtures/check-shared-cell-settlement.mjs");
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==";
  const askCode = `gateway.ask(questions=[{'id':'continue','question':'Continue this owned cell?','options':[{'label':'Continue'}]}])`;
  const imports = "import os, time\n";
  const f = await createYieldedSdkCell(target);
  const settled = async (run) => {
    const result = await within(run.completion, "host operation did not complete");
    await until(() => f.host.isIdle && f.session.isIdle, "native wake did not settle");
    return result;
  };
  const finish = async (cellId) => {
    await until(() => f.nativeEvents(cellId, "finished").length === 1 && f.host.isIdle && f.session.isIdle, "finished was not recorded once and settled");
    return f.nativeEvents(cellId, "finished")[0];
  };
  const ask = () => until(() => f.ui.snapshot().prompts.find(({ kind }) => kind === "ask"), "real background ask did not open");
  const go = f.path("late-callback-go"), answered = f.path("ask-answered"), done = f.path("happy-finish");
  const run = await f.start(`${imports}${f.waitCode(go)}\nassert gateway.late_probe() == 'HOOK_REWRITTEN'\nanswer = ${askCode}\nassert 'Continue' in answer\nopen(${JSON.stringify(answered)}, 'w').close()\n${f.waitCode(done)}\nretained_after_yield = 42\nprint('HOOK_AND_ASK_APPLIED')\ndisplay({'image/png':${JSON.stringify(png)}}, raw=True)`);
  const first = await f.running(run);
  assert.equal((await settled(run)).status, "completed");
  assert(f.events.some(({ type }) => type === "agent_end"), "the original low-level agent run ended before any late callback");
  assert(!f.session.getCallableToolNames().includes("kernel_read") && !f.session.getCallableToolNames().includes("kernel_interrupt"));
  const liveRead = await f.start({ cell_id: first.cell.cellId, yield_s: 0 }, { tool: "kernel_read" });
  await settled(liveRead);
  assert.equal(JSON.parse(text(f.parent(liveRead.id))).cell_id, first.cell.cellId);
  await f.release(go);
  const question = await ask();
  const late = f.hooks.filter(({ parentToolCallId }) => parentToolCallId === run.id);
  assert.deepEqual(late.filter(({ toolName }) => toolName === "late_probe").map(({ phase }) => phase), ["call", "result"]);
  assert(late.every(({ afterEnd, signal }) => afterEnd && signal instanceof AbortSignal && !signal.aborted), "real hooks retain the cell scope beyond parent return and agent_end");
  const callsDuringAsk = f.provider.state.callCount;
  await f.clock.advance(30_000); // Cross every 1s/3s/6s rung AND the 10s hard deadline while waiting for the user.
  assert.equal(f.owner.getSnapshot().state, "busy");
  assert.equal(f.ui.snapshot().prompts[0].id, question.id);
  assert.equal(f.reminders.length, 0, "ask pauses the active ladder rather than merely hiding notifications");
  assert.equal(f.provider.state.callCount, callsDuringAsk);
  const answeredDialog = await f.host.extensionUiAction({ operation: "dialog", id: question.id, answers: [{ id: "continue", selected: [0] }] });
  assert.equal(answeredDialog.status, "completed");
  assert.equal(answeredDialog.streamId, f.host.streamId);
  assert.equal(answeredDialog.extensionUi.prompts.length, 0);
  await until(() => f.exists(answered), "answered ask did not resume the same Python cell");
  await f.clock.advance(999);
  assert.equal(f.reminders.length, 0, "answer resumes the original remaining active delay");
  await f.clock.advance(1);
  await until(() => f.nativeEvents(first.cell.cellId, "checkpoint").length === 1 && f.host.isIdle && f.session.isIdle, "first checkpoint did not wake through native SDK history");
  await f.clock.advance(2000);
  await until(() => f.nativeEvents(first.cell.cellId, "checkpoint").length === 2 && f.host.isIdle && f.session.isIdle, "second checkpoint was merged or lost");
  const checkpoints = f.nativeEvents(first.cell.cellId, "checkpoint");
  assert.equal(new Set(checkpoints.map(({ details }) => details.eventId)).size, 2);
  assert.deepEqual(checkpoints.map(({ details }) => details.activeMs), [1000, 3000]);
  assert(checkpoints.every((entry) => !Array.isArray(entry.content) || !entry.content.some(({ type }) => type === "image")));
  const beforeImage = f.requests.length;
  await f.release(done);
  const completed = await finish(first.cell.cellId);
  assert.equal(completed.details.outcome, "ok");
  assert.deepEqual(completed.details.lateCallbacks, [{ name: "late_probe", status: "ok" }, { name: "ask", status: "ok" }]);
  assert.equal(completed.details.callbacksTruncated, false);
  assert.match(text(completed), /HOOK_AND_ASK_APPLIED/);
  const image = completed.content.find(({ type }) => type === "image");
  assert(image, "finished custom-message content, not details/JSON, carries a real image");
  assert.equal(image.mimeType, "image/png");
  assert.deepEqual(Buffer.from(image.data, "base64").subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert(f.requests.slice(beforeImage).some(({ messages }) => messages.some((message) => message.role === "user" && Array.isArray(message.content)
    && message.content.some((part) => part.type === "image" && part.data === image.data && part.mimeType === image.mimeType))), "the visual faux provider actually receives ImageContent in its model request");
  assert.deepEqual(f.parent(run.id), first.result, "late nested calls cannot backfill the frozen SDK parent result or nestedCalls");
  assert.equal(f.events.filter((event) => event.type === "message_end" && event.message.role === "toolResult" && event.message.toolCallId === run.id).length, 1);
  assert(!f.session.messages.some((message) => message.role === "toolResult" && message.parentToolCallId === run.id));
  await f.clock.advance(30_000);
  assert.equal(f.nativeEvents(first.cell.cellId, "finished").length, 1);
  const imageRead = await f.start({ cell_id: first.cell.cellId, image_index: 1 }, { tool: "kernel_read" });
  await settled(imageRead);
  assert.deepEqual(f.parent(imageRead.id).content, [image]);
  const missing = await f.start({ cell_id: crypto.randomUUID() }, { tool: "kernel_read" });
  await settled(missing);
  assert.equal(f.parent(missing.id).isError, true);
  assert.match(text(f.parent(missing.id)), /No readable cell/);

  // A stale Esc observes the previous cell/operation, never whichever cell is now running.
  const stopGo = f.path("stop-ask-go");
  const stoppedRun = await f.start(`${imports}${f.waitCode(stopGo)}\n${askCode}\nretained_after_yield = -1`);
  const stopped = await f.running(stoppedRun);
  await settled(stoppedRun);
  assert.equal((await f.host.interruptCell(first.cell)).status, "not_found");
  assert.equal((await f.host.cancel({ operationId: run.operationId, cell: first.cell })).status, "already_complete");
  assert.deepEqual(f.owner.getSnapshot().activeCells.map(({ cellId }) => cellId), [stopped.cell.cellId]);
  assert.equal(f.owner.getSnapshot().state, "busy");
  await f.release(stopGo);
  const stoppedQuestion = await ask();
  const beforeStop = f.provider.state.callCount;
  const remindersBeforeStop = f.reminders.length;
  await f.clock.advance(30_000);
  assert.equal(f.reminders.length, remindersBeforeStop);
  assert.deepEqual(f.owner.getSnapshot().activeCells.map(({ cellId }) => cellId), [stopped.cell.cellId], "ask also pauses the hard limit on the stop path");
  assert.equal((await f.host.interruptCell(stopped.cell)).status, "requested", "an idle host can interrupt a yielded ask without a fabricated operationId");
  const aborted = await finish(stopped.cell.cellId);
  assert.equal(aborted.details.outcome, "aborted");
  assert.equal(f.ui.snapshot().prompts.length, 0, "cell cancellation closes its real hosted ask");
  assert(f.hooks.filter(({ parentToolCallId, toolName }) => parentToolCallId === stoppedRun.id && toolName === "ask")
    .some(({ signal }) => signal instanceof AbortSignal && signal.aborted), "the stopped ask's real SDK hook inherits the cell cancellation source");
  assert.equal((await f.host.extensionUiAction({ operation: "dialog", id: stoppedQuestion.id, answers: [{ id: "continue", selected: [0] }] })).status, "unavailable");
  await f.clock.advance(30_000);
  assert.equal(f.provider.state.callCount, beforeStop, "user stop records the cancellation without waking a new model turn");
  assert.equal(f.nativeEvents(stopped.cell.cellId, "checkpoint").length, 0);
  assert.equal((await f.host.interruptCell(stopped.cell)).status, "not_found");

  // These are true Pi settlement windows: public agent_settled hook held, isIdle true,
  // but waitForIdle captured at agent_start remains pending. No private SDK fields or patches.
  for (const kind of ["checkpoint", "finished"]) for (const stop of [false, true]) {
    const release = f.path(`window-${kind}-${stop}`);
    const windowRun = await f.start(`${imports}${f.waitCode(release)}\nwindow_finished = True`, { settle: true });
    const current = await f.running(windowRun);
    try {
      await within(windowRun.gate.entered.promise, "public agent_settled gate did not open");
      assert.equal(windowRun.gate.window.idle, true);
      assert.equal(windowRun.gate.window.idleWaitPending, true);
      const calls = f.provider.state.callCount;
      const rawReminders = f.reminders.length;
      if (kind === "checkpoint") {
        await f.clock.advance(1000);
        assert.equal(f.reminders.length, rawReminders + 1, "the checkpoint really became due inside the settlement hook");
      } else {
        await f.release(release);
        await until(() => f.owner.getSnapshot().state === "idle", "cell did not finish inside the settlement hook");
      }
      assert.equal(f.nativeEvents(current.cell.cellId, kind).length, 0, "PRK holds the wake before submitting anything to Pi");
      assert.equal(f.provider.state.callCount, calls);
      console.log(JSON.stringify({ proof: "true-agent-settled-window", kind, stop, ...windowRun.gate.window, nativeEventsHeld: 0 }));
      if (stop) assert.equal((await f.host.cancel({ operationId: windowRun.operationId, cell: current.cell })).status, "requested");
      windowRun.gate.release.resolve();
      assert.equal((await settled(windowRun)).status, stop ? "cancelled" : "completed");
      if (kind === "checkpoint" && !stop) {
        await until(() => f.nativeEvents(current.cell.cellId, "checkpoint").length === 1 && f.host.isIdle && f.session.isIdle, "held checkpoint was not delivered after settlement");
        await f.release(release);
      }
      const terminal = await finish(current.cell.cellId);
      assert.equal(terminal.details.outcome, stop && kind === "checkpoint" ? "aborted" : "ok");
      assert.equal(f.nativeEvents(current.cell.cellId, "checkpoint").length, kind === "checkpoint" && !stop ? 1 : 0);
      await f.clock.advance(30_000);
      assert.equal(f.provider.state.callCount, calls + (stop ? 0 : kind === "checkpoint" ? 2 : 1), "each released wake starts one native turn; user stop revokes every held wake");
      assert.equal(f.nativeEvents(current.cell.cellId, "finished").length, 1);
    } finally { windowRun.gate.release.resolve(); }
  }
  const modelGo = f.path("model-interrupt");
  const modelCell = await f.start(`${imports}${f.waitCode(modelGo)}`);
  const modelRunning = await f.running(modelCell);
  await settled(modelCell);
  const modelStop = await f.start({ cell_id: modelRunning.cell.cellId }, { tool: "kernel_interrupt" });
  await settled(modelStop);
  assert.equal(JSON.parse(text(f.parent(modelStop.id))).status, "requested");
  assert.equal((await finish(modelRunning.cell.cellId)).details.outcome, "aborted");

  const retained = await f.start("print(retained_after_yield)", { yield_s: 1 });
  assert.equal((await settled(retained)).status, "completed");
  assert.equal(text(f.parent(retained.id)), "42\n", "stops retain the owned REPL and discard the late ask continuation");
  assert.equal(f.owner.getSnapshot().kernelId, first.cell.kernelId);
  assert.deepEqual(f.errors, [], "no SDK extension errors were hidden by the fixture");
  console.log("PASS yielded real SDK cell: late hooks, ask active-time pause/answer/stop, once-only image completion, stale Esc, and checkpoint/finished settlement-window fencing");
  await checkSharedCellSettlement(target);
  console.log("PASS shared settlement: stopped A is history-only, B wakes once, and only A is unknown after reopening without its result");
});
