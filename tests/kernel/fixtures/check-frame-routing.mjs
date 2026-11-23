import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { DEFAULT_KERNEL_RUNTIME_OPTIONS } from "../../../src/kernel/kernel-options.ts";
import { KERNEL_TOOL_CATALOG_MIME } from "../../../src/codemode/module-catalog/catalog-protocol.ts";
import { createRoutingGateway, text, until } from "./create-routing-gateway.mjs";

const png = { type: "image", mimeType: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==" };
const gif = { type: "image", mimeType: "image/gif", data: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" };
const maxImageBytes = 256; // Exercise the production accounting with a reduced limit, not a 20 MiB allocation.
const maxOutputChars = 256;
const cap = (name) => ({ name: `routing_${name}`, signature: `${name}()`, description: name, available: true });
const question = (id) => ({ id, question: `Confirm ${id} 😀?`, options: [{ label: `Answer ${id}` }] });
const ask = (id) => ({ name: "ask", args: { questions: [question(id)] } });
const identity = ({ generation, cellId }) => ({ kernelId: generation, cellId });

export async function checkFrameRouting(home, python) {
  assert.equal(DEFAULT_KERNEL_RUNTIME_OPTIONS.maxImageBytes, 20 * 1024 * 1024, "production aggregate image cap is 20 MiB");
  const f = await createRoutingGateway(home, python, { maxImageBytes, maxOutputChars });
  const { peer, kernel } = f;
  const emit = (cell, frame) => peer.emit({ cellId: cell.cellId, ...frame });
  const stream = (cell, message) => emit(cell, { kind: "stream", stream: "stdout", text: `${message}\n` });
  const end = (cell, outcome) => emit(cell, { kind: "cell_end", re: cell.id, outcome });
  const ack = (frame) => emit(frame, { kind: "ack", re: frame.id });
  const image = (cell, imageId, { mimeType }, data, final) => emit(cell, { kind: "image", imageId, mimeType, data, final });
  const result = (cell) => until(() => f.result(cell).result, `frozen result for ${cell.code}`);
  const promptFor = (cell, questionId) => until(() => f.asks().find((prompt) => prompt.questions[0].id === questionId), `ask for ${cell.code}`);

  try {
    const aDone = await f.turn("kernel_code", { code: "ROUTE_A", yield_s: 0 });
    const init = await f.next("initialize");
    emit(init, { kind: "display", data: { [KERNEL_TOOL_CATALOG_MIME]: [cap("allowed"), cap("denied")] }, metadata: {} });
    end(init, "ok");
    const a = await f.next("execute");
    peer.admit(a);
    await assertRunning(a, aDone);
    const bDone = await f.turn("kernel_code", { code: "ROUTE_B", yield_s: 0 });
    const b = await f.next("execute");
    peer.admit(b);
    await assertRunning(b, bDone);
    assert.notEqual(a.cellId, b.cellId);
    assert.equal(a.generation, b.generation);
    assert.equal(peer.starts, 1);

    // Same local request IDs, independent decoders and permission results. A and B finish in reverse order.
    const aPermission = beginCallback(a, 1, "capability", { name: "routing_allowed" });
    const bPermission = beginCallback(b, 1, "capability", { name: "routing_denied" });
    bPermission();
    aPermission();
    await reply(b, 1, { ok: false, error: 'Kernel function "routing_denied" is disabled for this session.' });
    await reply(a, 1, { ok: true });

    const aAsk = beginCallback(a, 2, "gateway", ask("alpha"));
    image(a, 1, png, png.data.slice(0, 32), false);
    const bAsk = beginCallback(b, 2, "gateway", ask("beta"));
    image(b, 1, gif, gif.data.slice(0, 24), false);
    image(a, 1, png, png.data.slice(32), true);
    bAsk();
    image(b, 1, gif, gif.data.slice(24), true);
    // Pi serializes the ask tool. Complete A's chunks while B's asynchronous card is still open,
    // then let Pi open A's card naturally rather than bypassing its nested-tool scheduler.
    const beta = await promptFor(b, "beta");
    assert.deepEqual([beta.kernelId, beta.cellId, beta.questions[0].question], [b.generation, b.cellId, question("beta").question]);
    aAsk();
    assert.equal((await f.answer(beta, 0)).status, "completed");
    await reply(b, 2, { ok: true, value: "User answers:\nbeta: Answer beta" });
    const alpha = await promptFor(a, "alpha");
    assert.deepEqual([alpha.kernelId, alpha.cellId, alpha.questions[0].question], [a.generation, a.cellId, question("alpha").question]);
    assert.notEqual(alpha.id, beta.id);
    assert.equal((await f.answer(alpha, 0)).status, "completed");
    await reply(a, 2, { ok: true, value: "User answers:\nalpha: Answer alpha" });

    const completeBytes = [png, gif].reduce((sum, item) => sum + Buffer.from(item.data, "base64").length, 0);
    const partial = Buffer.alloc(maxImageBytes - completeBytes - 3).toString("base64");
    assert(completeBytes + Buffer.from(gif.data, "base64").length < maxImageBytes, "completed images alone fit");
    image(a, 2, png, partial.slice(0, 48), false);
    image(a, 2, png, partial.slice(48), false); // Never finalized; A holds nearly all remaining credit.
    image(b, 2, gif, gif.data.slice(0, 24), false); // Crosses the aggregate limit here, while each cell is under it.
    image(b, 2, gif, gif.data.slice(24), true); // Drain the omitted image without losing framing or counting it twice.
    stream(b, "B_DRAINED_AFTER_OMISSION");
    // Regression witness: remove aggregate charging (or charge finalized images only) and this resolves instead.
    await assert.rejects(kernel.readCell(b.cellId, 0, 2), { code: "NOT_FOUND" }, "B's second image must be omitted while A owns unfinalized bytes");
    assert.deepEqual((await kernel.readCell(b.cellId, 0, 1)).content.filter(({ type }) => type === "image"), [gif]);

    for (let index = 0; index < 4; index++) {
      peer.emit({ kind: "diagnostic", stream: "stdout", text: `OWNERLESS_STDOUT ${"x".repeat(100)}\n` });
    }
    peer.emit({ kind: "diagnostic", stream: "stderr", text: "OWNERLESS_STDERR\n" });
    const diagnostics = kernel.getSnapshot().diagnostics;
    assert(diagnostics, "ownerless bytes must be visible in the kernel diagnostic snapshot");
    assert.match(diagnostics.stdout, /OWNERLESS_STDOUT/);
    assert.equal(diagnostics.stderr, "OWNERLESS_STDERR\n");
    assert.equal(diagnostics.truncated, true);
    assert(diagnostics.stdout.length <= maxOutputChars, "ownerless stdout is bounded");

    peer.emit({ kind: "stream", stream: "stdout", cellId: b.cellId, generation: `${b.generation}-stale`, text: "FOREIGN_GENERATION" });
    emit({ cellId: "foreign-cell" }, { kind: "error", name: "ForeignError", message: "FOREIGN_CELL", traceback: [] });
    emit(b, { kind: "cell_end", re: a.id, outcome: "error" });
    emit(a, { kind: "error", name: "ValueError", message: "A_ONLY_ERROR", traceback: ["A_ONLY_TRACE\n"] });
    // Slice 04 accepts these frames without projecting new public cell states.
    emit(b, { kind: "cell_state", state: "running" });
    const bRead = await (await f.turn("kernel_read", { cell_id: b.cellId }))();
    const bPreview = JSON.parse(text(bRead));
    assert.equal(bPreview.cell_id, b.cellId);
    assert.equal(bPreview.status, "running", "a mismatched terminal request must not finish B");
    assert.match(bPreview.output, /B_DRAINED_AFTER_OMISSION/);
    assert.doesNotMatch(JSON.stringify(bRead), /OWNERLESS|FOREIGN_|A_ONLY_/);
    assert.equal(Object.hasOwn(bRead.details, "diagnostics"), false);
    assert.equal(kernel.getSnapshot().kernelId, b.generation, "a valid stale-generation frame must not retire this process");

    beginCallback(a, 3, "gateway", ask("revoked"))();
    const revoked = await promptFor(a, "revoked");
    assert.equal((await f.session.interruptCell({ ...identity(a), cellOnly: true })).status, "requested");
    ack(await f.next("cancel", a));
    emit(a, { kind: "cell_state", state: "stopping" });
    await until(() => !f.asks().some(({ id }) => id === revoked.id), "the interrupted cell's ask to close");
    assert.equal((await f.answer(revoked, 0)).status, "unavailable", "an asynchronous answer after revocation cannot reopen the ask");
    beginCallback(a, 4, "capability", { name: "routing_allowed" })(); // Still live, but callback authority was revoked.
    end(a, "aborted");
    const frozenA = await result(a);
    assert.equal(frozenA.details.outcome, "aborted");
    assert.match(text(frozenA), /ValueError: A_ONLY_ERROR\nA_ONLY_TRACE/);
    assert.doesNotMatch(JSON.stringify(frozenA), /OWNERLESS|FOREIGN_|B_DRAINED/);
    assert.deepEqual(f.result(a, 1).result.content.filter(({ type }) => type === "image"), [png]);

    // A's terminal result has frozen. The very same B image that was omitted must now fit.
    image(b, 3, gif, gif.data, true);
    assert.deepEqual((await kernel.readCell(b.cellId, 0, 2)).content.filter(({ type }) => type === "image"), [gif],
      "freezing A must return its finished and unfinished image credit to B");
    const cDone = await f.turn("kernel_code", { code: "ROUTE_REJECTED", yield_s: 15 });
    const c = await f.next("execute"); // Also rejects any unexpected late reply for A before this write.
    assert.equal(c.generation, b.generation);
    assert.equal(c.code, "ROUTE_REJECTED");
    emit(c, { kind: "rejected", re: c.id, code: "BUSY" });
    const rejected = await cDone();
    assert.equal(rejected.isError, true);
    assert.match(text(rejected), /Runner rejected command: BUSY/);

    beginCallback(b, 3, "capability", { name: "routing_allowed" })(); // Same ID as A's cancelled ask, still usable in B.
    await reply(b, 3, { ok: true });
    const exitDone = await f.turn("kernel_code", { code: "ROUTE_PHYSICAL_STDERR", yield_s: 0 });
    const exiting = await f.next("execute");
    peer.admit(exiting);
    await assertRunning(exiting, exitDone);
    stream(b, "B_SURVIVED_REJECTION");
    end(b, "ok");
    const frozenB = await result(b);
    assert.equal(frozenB.details.outcome, "ok");
    assert.equal(f.result(b).imageCount, 2);
    assert.match(text(frozenB), /B_DRAINED_AFTER_OMISSION\nB_SURVIVED_REJECTION/);
    assert.match(text(frozenB), /\[1 additional image outputs omitted\.\]/);
    assert.doesNotMatch(JSON.stringify(frozenB), /OWNERLESS|FOREIGN_|A_ONLY_|Runner rejected/);
    assert.equal(kernel.getSnapshot().kernelId, b.generation);
    assert.equal(peer.starts, 1);
    await setImmediate();
    f.noExtraFrames();

    const { stderr } = peer; // Keep the physical transport callback for this generation, including after replacement.
    const physical = "OWNERLESS_PHYSICAL_STDERR 😀\n";
    const bytes = Buffer.from(physical);
    stderr(bytes.subarray(0, -3)); // Split inside the emoji.
    stderr(bytes.subarray(-3));
    assert.equal(kernel.getSnapshot().diagnostics.stderr, `OWNERLESS_STDERR\n${physical}`);
    let reason;
    const unsubscribe = kernel.subscribeFinished((cell) => { if (cell.cellId === exiting.cellId) reason = cell.reason; });
    try {
      peer.exit(17);
      const frozen = await result(exiting);
      assert.equal(frozen.details.outcome, "unknown");
      assert.doesNotMatch(JSON.stringify(frozen), /OWNERLESS/);
      assert.equal(reason, "Kernel exited (17).");
      assert.match(kernel.getSnapshot().diagnostics.stderr, /OWNERLESS_PHYSICAL_STDERR/);
    } finally { unsubscribe(); }

    const reopening = kernel.ensure();
    const newInit = await f.next("initialize");
    assert.notEqual(newInit.generation, exiting.generation);
    stderr("LATE_OLD_STDERR\n");
    assert.equal(kernel.getSnapshot().diagnostics, undefined);
    peer.stderr(`${"x".repeat(maxOutputChars)}NEW_PHYSICAL_STDERR\n`);
    const current = kernel.getSnapshot().diagnostics;
    assert.equal(current.truncated, true);
    assert.equal(current.stderr.length, maxOutputChars);
    assert.match(current.stderr, /NEW_PHYSICAL_STDERR\n$/);
    end(newInit, "ok");
    await reopening;
    return { routedCells: 2, rejectedSibling: true, productionImageBytes: 20 * 1024 * 1024, exercisedImageBytes: maxImageBytes };
  } finally { await f.close(); }

  function beginCallback(cell, requestId, channel, payload) {
    const bytes = Buffer.from(JSON.stringify(payload));
    const emoji = bytes.indexOf(Buffer.from("😀"));
    const split = emoji === -1 ? 8 : emoji + 2; // Split ask inside a UTF-8 code point, not just at a JSON token boundary.
    const send = (data, final) => emit(cell, { kind: "callback_chunk", requestId, channel, data: data.toString("base64"), final });
    send(bytes.subarray(0, split), false);
    return () => send(bytes.subarray(split), true);
  }

  async function reply(owner, requestId, expected) {
    const chunks = [];
    for (;;) {
      const frame = await f.next("callback_reply_chunk", owner);
      assert.equal(frame.requestId, requestId, `wrong callback request for ${owner.code}`);
      chunks.push(Buffer.from(frame.data, "base64"));
      ack(frame);
      if (frame.final) break;
    }
    assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString("utf8")), expected, `${owner.code} reply ${requestId}`);
  }
}

async function assertRunning(cell, done) {
  const result = await done();
  assert.equal(Boolean(result.isError), false, text(result));
  const { status, cell_id } = JSON.parse(text(result));
  assert.deepEqual([status, cell_id, result.details.kernelId], ["running", cell.cellId, cell.generation]);
}
