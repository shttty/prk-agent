import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { assertProcessExited } from "../fixtures/target-environment/assert-process-exited.mjs";

// Real SDK/faux + Python + persistent native tree. No daily home, provider network, patched SDK or fabricated receipts.
assert.equal(process.env.JUPYTER_URL, undefined);
assert.equal(process.env.JUPYTER_TOKEN, undefined);
function within(promise, label) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Cell recovery: ${label}`)), 30_000); })])
    .finally(() => clearTimeout(timer));
}
const contents = (path) => readFile(path, "utf8").catch((error) => { if (error.code === "ENOENT") return ""; throw error; });
async function launch(root, config, boundary, sessionId) {
  const child = spawn(process.execPath, [fileURLToPath(new URL("./cell-delivery-recovery/runtime-process.mjs", import.meta.url))], {
    cwd: root, env: { ...process.env, PRK_HOME: root, PRK_CODING_AGENT_DIR: join(root, "agent"), PI_CODING_AGENT_DIR: join(root, "agent") },
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  let stderr = "", serial = 0;
  const replies = new Map(), ready = Promise.withResolvers();
  const exited = once(child, "exit");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("message", (message) => {
    if (message.type === "ready") { ready.resolve(message); return; }
    const reply = replies.get(message.id);
    if (!reply) return;
    replies.delete(message.id);
    if (message.error) reply.reject(new Error(message.error)); else reply.resolve(message.data);
  });
  child.on("error", (error) => ready.reject(error));
  void exited.then(([code, signal]) => {
    const error = new Error(`Owned runtime exited (${code ?? signal}): ${stderr}`);
    ready.reject(error);
    for (const reply of replies.values()) reply.reject(error);
    replies.clear();
  });
  const request = (method, args) => {
    const id = ++serial, reply = Promise.withResolvers();
    replies.set(id, reply);
    child.send({ id, method, args });
    return within(reply.promise, `${boundary} ${method}; ${stderr}`);
  };
  child.send({ root, config, boundary, sessionId });
  try {
    const info = await within(ready.promise, `${boundary} startup`);
    return { ...info, request,
      async kill() {
        if (child.exitCode !== null || child.signalCode !== null) return;
        assert(child.kill("SIGKILL"));
        assert.deepEqual(await within(exited, "runtime SIGKILL"), [null, "SIGKILL"]);
      },
      async stop() {
        if (child.exitCode !== null || child.signalCode !== null) return;
        try {
          assert.deepEqual(await request("stop"), { stopped: true });
          assert.deepEqual(await within(exited, "runtime shutdown"), [0, null], stderr);
        } finally {
          if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await exited; }
        }
      },
    };
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await exited;
    throw error;
  }
}
await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
  initializePrkHome(tempRoot); // Bind the SDK before its first import, including history-only imports below.
  const { createSessionHistory } = await import("../../src/sessions/history/assemble-history.ts");
  const { listCellDeliveries, readCellDelivery } = await import("../../src/sessions/history/kernel-cells/read-deliveries.ts");
  const { readSavedCellResult } = await import("../../src/sessions/history/kernel-cells/read-result.ts");
  for (const boundary of ["open", "result", "native"]) {
    const root = join(tempRoot, boundary);
    await mkdir(root);
    let runtime = await launch(root, config, boundary);
    onCleanup(() => runtime.stop());
    const cell = await runtime.request("run");
    assert.equal(await contents(join(root, "executions")), "execute\n");
    const live = await runtime.request("project", { cellId: cell.cellId });
    assert.equal(live.view.delivery, "running");
    if (boundary === "open") {
      assert.deepEqual(await runtime.request("reclaim"), { sleeping: false, runtimePresent: true, active: true, hostIdle: true, sdkIdle: true },
        "actual idle reclamation must preserve a cell even after its SDK operation is idle");
    } else {
      assert.deepEqual(await runtime.request("finish"), { opens: 1, results: 1, finished: boundary === "native" ? 1 : 0 });
    }
    // The injected crash follows the actual native write, not message_end (Pi notifies before persisting).
    const sessionId = runtime.sessionId, sessionFile = runtime.sessionFile;
    const beforeBoot = await contents(join(root, "provider-calls"));
    const beforeAcquire = await contents(join(root, "acquires"));
    await runtime.kill();
    await assertProcessExited(cell.pid);
    const history = await createSessionHistory({ cwd: root, directory: join(root, "history") });
    const manager = history.get(sessionId).manager;
    assert(manager.isPersisted());
    assert.equal(manager.getSessionFile(), sessionFile);
    const counts = () => ({
      opens: manager.getEntries().filter((entry) => entry.customType === "kernel-cell-open").length,
      results: manager.getEntries().filter((entry) => entry.customType === "kernel-cell-result").length,
      finished: manager.getEntries().filter((entry) => entry.type === "custom_message" && entry.customType === "kernel-event" && entry.details.kind === "finished").length,
    });
    const expectedCounts = { opens: 1, results: boundary === "open" ? 0 : 1, finished: boundary === "native" ? 1 : 0 };
    assert.deepEqual(counts(), expectedCounts);
    const leaf = manager.getLeafId();
    const deliveries = listCellDeliveries(manager);
    assert.equal(deliveries.length, 1, "one execution has exactly one reconciled conclusion");
    const delivery = readCellDelivery(manager, cell.cellId);
    assert.deepEqual(deliveries, [delivery]);
    assert.equal(delivery.delivery, { open: "unknown", result: "unconfirmed", native: "delivered" }[boundary]);
    assert.equal(delivery.outcome, boundary === "open" ? "unknown" : "ok");
    assert.equal(delivery.imageCount, boundary === "open" ? 0 : 1);
    assert.equal(delivery.toolCallId, cell.toolCallId);
    assert.equal(delivery.kernelId, cell.kernelId);
    assert.equal(delivery.startedAt, cell.startedAt);
    const saved = readSavedCellResult(manager, cell.cellId);
    const image = saved?.content.find(({ type }) => type === "image");
    if (boundary === "open") assert.equal(saved, undefined);
    else {
      assert.match(saved.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n"), /SAVED_FINAL/);
      assert.equal(image.mimeType, "image/png");
      assert.deepEqual(Buffer.from(image.data, "base64").subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    assert.equal(manager.getLeafId(), leaf, "reconciliation is read-only");
    runtime = await launch(root, config, boundary, sessionId);
    assert.equal(runtime.sessionId, sessionId);
    assert.equal(await contents(join(root, "provider-calls")), beforeBoot, "restart never replays input or wakes the model");
    assert.equal(await contents(join(root, "acquires")), beforeAcquire, "restart does not reclaim the old execution handle or create a REPL");
    const projected = await runtime.request("project", { cellId: cell.cellId });
    assert.deepEqual(projected.snapshot.kernelCells, [delivery]);
    assert.equal(projected.view.delivery, delivery.delivery);
    assert(!projected.view.result?.content.some(({ type }) => type === "image"), "default Gateway result reads contain no image payload");
    assert(!JSON.stringify(projected.snapshot.kernelCells).includes("data"), "snapshot reconciliation contains metadata only");
    const read = await runtime.request("read", { cell_id: cell.cellId });
    assert.equal(read.details.outcome, boundary === "open" ? "unknown" : "ok");
    if (image) {
      const fromGateway = await runtime.request("project", { cellId: cell.cellId, imageIndex: 1 });
      assert.deepEqual(fromGateway.view.result.content.filter(({ type }) => type === "image"), [image]);
      const fromTool = await runtime.request("read", { cell_id: cell.cellId, image_index: 1 });
      assert.deepEqual(fromTool.content, [image], "kernel_read retrieves the retained image across SIGKILL and SDK replacement");
    }
    assert.equal(await contents(join(root, "executions")), "execute\n", "neither reconciliation nor explicit reads re-execute Python");
    assert.equal(await contents(join(root, "acquires")), beforeAcquire, "all recovered result reads stay observation-only");
    assert.equal((await contents(join(root, "tool-submissions"))).split("\n").filter((name) => name === "kernel_code").length, 1);
    assert.deepEqual(await runtime.request("reclaim"), { sleeping: true, runtimePresent: false, active: false, hostIdle: false, sdkIdle: true },
      "the same real reclamation path sleeps the idle restarted runtime once no cell is in flight");
    await runtime.stop();
    const finalHistory = await createSessionHistory({ cwd: root, directory: join(root, "history") });
    const finalManager = finalHistory.get(sessionId).manager;
    assert.equal(finalManager.getEntries().filter((entry) => entry.customType === "kernel-cell-result").length, expectedCounts.results);
    assert.equal(finalManager.getEntries().filter((entry) => entry.type === "custom_message" && entry.customType === "kernel-event" && entry.details.kind === "finished").length, expectedCounts.finished,
      "restart, reads and idle teardown must not duplicate or replay a finished notification");
    const beforeOpen = finalManager.getBranch().find((entry) => entry.type === "custom" && entry.customType === "kernel-cell-open").parentId;
    finalManager.branch(beforeOpen);
    assert.deepEqual(listCellDeliveries(finalManager), [], "an abandoned SDK branch cannot supply another branch's result");
    assert.equal(readSavedCellResult(finalManager, cell.cellId), undefined);
  }
  console.log("PASS cell delivery recovery: actual open/result/custom_message SIGKILL, native branch reconciliation, no execute/finished replay, retained image reads and real idle reclamation");
});
