import assert from "node:assert/strict";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { createYieldedSdkCell, text, until, within } from "./fixtures/create-yielded-sdk-cell.mjs";

const rawLine = "RAW_FD_DIAGNOSTIC\n";
const unownedLine = "UNOWNED_THREAD_DIAGNOSTIC\n";
const aReady = "A: print before ask\nA: display before ask\n";
const aResumed = aReady + "A: print after ask\nA: display after ask\n";
const aFinished = aResumed + "A: figure survived B\n";
const bReady = "B: print before ask\nB: display before ask\n";
const bFinished = bReady + "B: print after ask\nB: display after ask\n";

const askCode = (cell) => `gateway.ask(questions=[{'id': 'release-${cell}', 'question': 'Release ${cell}?', 'options': [{'label': 'Answer for ${cell}'}]}])`;
const asksOnly = (f) => f.ui.snapshot().prompts.filter(({ kind }) => kind === "ask");

await withTargetFixture(async (target) => {
  const f = await createYieldedSdkCell(target, { maxActiveCells: 2 });
  const finishedDetails = new Map();
  target.onCleanup(f.owner.subscribeFinished(({ cellId, result }) => finishedDetails.set(cellId, result.details)));
  const startAskA = f.path("ask-a"), startAskB = f.path("ask-b");
  const finishA = f.path("b-finished");
  const expectLiveOutput = async ({ cellId }, expected) => {
    const lastLine = expected.trimEnd().split("\n").at(-1);
    const preview = await until(() => {
      const terminal = f.nativeEvents(cellId, "finished")[0];
      assert(!terminal, `cell finished before ${lastLine}: ${text(terminal)}`);
      const active = f.owner.previewCell(cellId);
      return active?.output.includes(lastLine) && active;
    }, `cell ${cellId} did not produce ${lastLine}`);
    assert.equal(preview.output, expected);
    assert.equal(preview.mode, "thread");
    assert.equal(preview.truncated, false);
  };
  const expectFinished = async (cell, run, expected, otherCell, imageCount) => {
    const entries = () => f.nativeEvents(cell.cellId, "finished");
    const entry = await until(() => entries()[0], `${run.id} did not record its finished result`);
    assert.equal(entries().length, 1);
    assert.equal(entry.details.outcome, "ok", text(entry));
    assert.equal(entry.details.kernelId, cell.kernelId);
    assert.equal(entry.details.toolCallId, run.id);
    assert.deepEqual(entry.details.lateCallbacks, [{ name: "ask", status: "ok" }]);
    const output = text(entry);
    const ownedPrefix = expected.slice(0, expected.indexOf(": ") + 2);
    assert.equal(entry.content[1]?.type, "text", output);
    assert.deepEqual(entry.content[1].text.split("\n").filter((line) => line.startsWith(ownedPrefix)), expected.trimEnd().split("\n"));
    for (const foreign of [`${otherCell}: `, rawLine.trimEnd(), unownedLine.trimEnd()]) {
      assert(!output.includes(foreign), `${run.id} received foreign output: ${output}`);
    }
    const images = entry.content.filter(({ type }) => type === "image");
    assert.equal(images.length, imageCount);
    return images;
  };
  const startCell = async (code, expected) => {
    const run = await f.start(code);
    assert.equal((await within(run.completion, "SDK turn did not settle")).status, "completed");
    await until(() => f.host.isIdle && f.session.isIdle, "SDK did not go idle");
    const parent = f.parent(run.id);
    assert(parent && !parent.isError, text(parent) || `No SDK tool result for ${run.id}`);
    const { cell } = await f.running(run);
    await expectLiveOutput(cell, expected);
    return { run, cell };
  };

  const { run: runA, cell: a } = await startCell(`
import os, threading, time
from pathlib import Path
import matplotlib
assert matplotlib.get_backend().lower() == 'agg'
import matplotlib.pyplot as plt

def wait_for_marker(path):
    deadline = time.monotonic() + 30
    while not Path(path).is_file():
        assert time.monotonic() < deadline, 'marker not released: ' + path
        time.sleep(0.01)

phase('phase A')
open('trace-a.txt', 'w').close()
owned_a_tid = threading.get_ident()
owned_figure, owned_axes = plt.subplots(figsize=(2, 1), dpi=60)
try:
    owned_axes.plot([0, 1], [0, 1])
    print('A: print before ask')
    display({'text/plain': 'A: display before ask\\n'}, raw=True)
    wait_for_marker(${JSON.stringify(startAskA)})
    assert owned_b_tid != owned_a_tid
    owned_a_answer = ${askCode("A")}
    assert owned_a_answer.endswith('release-A: Answer for A'), owned_a_answer
    print('A: print after ask')
    display({'text/plain': 'A: display after ask\\n'}, raw=True)
    wait_for_marker(${JSON.stringify(finishA)})
    assert plt.fignum_exists(owned_figure.number), 'B closed the figure owned by A'
    display(owned_figure)
finally:
    plt.close(owned_figure)
print('A: figure survived B')
`, aReady);
  const diagnosticBaseline = f.owner.getSnapshot().diagnostics ?? { stdout: "", stderr: "", truncated: false };
  assert.equal(diagnosticBaseline.stdout, "");
  assert.equal(diagnosticBaseline.truncated, false);

  const { run: runB, cell: b } = await startCell(`
phase('phase B')
open('trace-b.txt', 'w').close()
owned_b_tid = threading.get_ident()
assert owned_b_tid != owned_a_tid
assert plt.fignum_exists(owned_figure.number), 'A must have an open figure before B runs'
print('B: print before ask')
display({'text/plain': 'B: display before ask\\n'}, raw=True)
os.write(1, ${JSON.stringify(rawLine)}.encode('ascii'))
wait_for_marker(${JSON.stringify(startAskB)})
owned_b_answer = ${askCode("B")}
assert owned_b_answer.endswith('release-B: Answer for B'), owned_b_answer
# A separate Python thread has no cell owner, even while B waits for it.
no_owner = threading.Thread(target=print, args=(${JSON.stringify(unownedLine.trimEnd())},), daemon=True)
no_owner.start()
no_owner.join(5)
assert not no_owner.is_alive(), 'unowned print did not return'
print('B: print after ask')
display({'text/plain': 'B: display after ask\\n'}, raw=True)
`, bReady);
  assert.equal(a.kernelId, b.kernelId);
  assert.notEqual(a.cellId, b.cellId);

  // Both target threads must get this far before either can reach its ASK.
  await expectLiveOutput(a, aReady);
  const diagnostic = await until(() => {
    const snapshot = f.owner.getSnapshot();
    return snapshot.diagnostics?.stdout.includes(rawLine) && snapshot;
  }, "raw fd line did not reach the generation diagnostic");
  assert.equal(diagnostic.kernelId, a.kernelId);
  assert.deepEqual(diagnostic.diagnostics, { ...diagnosticBaseline, stdout: rawLine });
  assert.deepEqual(asksOnly(f), []);
  const waitForPrompt = (cell) => until(() => {
    const terminal = f.nativeEvents(cell.cellId, "finished")[0];
    assert(!terminal, `cell finished instead of waiting for its ASK: ${text(terminal)}`);
    return asksOnly(f).find(({ cellId }) => cellId === cell.cellId);
  }, `no SDK ASK for ${cell.cellId}`);
  await f.release(startAskA);
  const promptA = await waitForPrompt(a);
  await f.release(startAskB);
  await until(() => f.owner.previewCell(a.cellId)?.waitingForAsk && f.owner.previewCell(b.cellId)?.waitingForAsk,
    "both runner callback requests must be pending before replying to A");
  assert.deepEqual(asksOnly(f).map(({ id }) => id), [promptA.id], "SDK presents ask calls sequentially");
  const checkPrompt = (prompt, cell, letter) => {
    assert.equal(prompt.cellId, cell.cellId);
    assert.equal(prompt.kernelId, cell.kernelId);
    assert.deepEqual(prompt.questions.map(({ id }) => id), [`release-${letter}`]);
    assert.equal(f.owner.previewCell(cell.cellId).waitingForAsk, true);
  };
  checkPrompt(promptA, a, "A");
  const askHooks = (phase) => f.hooks.filter((event) => event.toolName === "ask" && event.phase === phase);
  const callId = (run) => askHooks("call").find(({ parentToolCallId }) => parentToolCallId === run.id)?.toolCallId;
  assert(callId(runA));
  assert.deepEqual(askHooks("result"), []);
  const answer = async (prompt) => {
    const reply = await within(f.host.extensionUiAction({ operation: "dialog", id: prompt.id,
      answers: [{ id: prompt.questions[0].id, selected: [0] }] }), "host did not accept ASK answer");
    assert.equal(reply.status, "completed");
  };

  await answer(promptA);
  await expectLiveOutput(a, aResumed);
  await expectLiveOutput(b, bReady);
  const promptB = await waitForPrompt(b);
  checkPrompt(promptB, b, "B");
  assert.notEqual(promptA.id, promptB.id);
  assert.deepEqual(askHooks("call").map(({ parentToolCallId }) => parentToolCallId), [runA.id, runB.id]);
  assert.notEqual(callId(runA), callId(runB));
  assert.deepEqual(asksOnly(f).map(({ id }) => id), [promptB.id]);
  assert.equal(f.owner.previewCell(b.cellId).waitingForAsk, true);
  assert.deepEqual(askHooks("result").map(({ toolCallId }) => toolCallId), [callId(runA)]);

  await answer(promptB);
  await expectFinished(b, runB, bFinished, "A", 0);
  assert.deepEqual(askHooks("result").map(({ toolCallId, parentToolCallId, isError }) => [toolCallId, parentToolCallId, isError]),
    [[callId(runA), runA.id, false], [callId(runB), runB.id, false]]);
  assert.equal(f.owner.previewCell(a.cellId)?.status, "running", "B must finish while A is still alive");
  assert.deepEqual(f.nativeEvents(a.cellId, "finished"), []);
  await f.release(finishA);

  const [image] = await expectFinished(a, runA, aFinished, "B", 1);
  assert.equal(image.mimeType, "image/png");
  assert.deepEqual(Buffer.from(image.data, "base64").subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  await until(() => f.owner.getSnapshot().state === "idle" && f.host.isIdle && f.session.isIdle, "finished cells did not settle");
  const snapshot = await until(() => {
    const current = f.owner.getSnapshot();
    return current.diagnostics?.stdout.includes(unownedLine) && current;
  }, "unowned thread print did not reach the generation diagnostic");
  assert.equal(snapshot.kernelId, a.kernelId);
  assert.deepEqual(snapshot.diagnostics, { ...diagnosticBaseline, stdout: rawLine + unownedLine });
  const { variables, added, modified, deleted } = snapshot.namespace;
  assert.deepEqual([added, modified, deleted], [[], [], []]);
  for (const [cell, letter] of [[a, "A"], [b, "B"]]) {
    const { phases, traces } = finishedDetails.get(cell.cellId);
    assert.deepEqual(phases.map(({ title }) => title), [`phase ${letter}`]);
    assert.deepEqual(traces.filter(({ args }) => args[0]?.includes("trace-")).map(({ args, phase }) => [args[0], phase]),
      [[`'trace-${letter.toLowerCase()}.txt'`, `phase ${letter}`]]);
  }
  for (const name of ["owned_a_answer", "owned_b_answer"]) {
    const variable = variables.find((entry) => entry.name === name);
    assert(variable, `missing shared variable ${name}`);
    assert(!Object.hasOwn(variable, "origin"), `unexpected cell attribution for ${name}`);
  }
  assert.deepEqual(f.errors, []);
  console.log("PASS real thread ownership: interleaved print/display, overlapping ASK replies, diagnostic-only raw/unowned output, and A's Agg figure surviving B");
});
