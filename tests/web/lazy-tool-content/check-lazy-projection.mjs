import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { SessionManager } from "@earendil-works/pi-coding-agent";

export async function checkLazyProjection({ host, name, until, events, ids, preview, partialA, largeArgs, fetchFull, text, releasePath, client, callsOf, inputA, resultOf, outputA, outputB, smallOutput, http, contentPath, sessionId, root, historyDir, contexts, page, bytes }) {
  const admission = await host.session(name).submit({ requestId: "lazy-tool-scenario", message: "Run the controlled lazy tool scenario." });
  assert.equal(admission.accepted, true);
  const update = await until(() => events.find((event) => event.details?.sdkType === "tool_execution_update" && event.details?.toolCallId === ids.a), "large live partial result");
  preview(update.details.outputPreview, partialA, "live partial output");
  assert(!JSON.stringify(update).includes("LAZY_DETAIL_FULL_TAIL"), "large live details are not a full-payload bypass");
  const inFlight = await fetchFull(ids.a);
  assert.deepEqual(inFlight.args, largeArgs);
  assert.equal(text(inFlight.result), partialA, "HTTP returns authoritative running partial content");
  assert.equal(inFlight.outputVersion, update.details.outputPreview.version);
  await writeFile(releasePath, "release");
  assert.equal((await admission.completion).status, "completed");
  const snapshot = await client.request("state", { sessionId: name });
  const largeCall = callsOf(snapshot.messages).find((call) => call.id === ids.a);
  preview(largeCall.inputPreview, inputA, "snapshot input");
  assert.deepEqual(largeCall.arguments, {}, "large input is absent from the initial snapshot");
  assert(!JSON.stringify(snapshot).includes("LAZY_INPUT_FULL_TAIL"), "no alternate snapshot field duplicates full input");
  const projectedA = resultOf(snapshot.messages, ids.a);
  const projectedB = resultOf(snapshot.messages, ids.b);
  preview(projectedA.outputPreview, outputA, "snapshot output A");
  preview(projectedB.outputPreview, outputB, "snapshot output B");
  assert.equal(text(projectedA), projectedA.outputPreview.preview);
  assert(!JSON.stringify(snapshot).includes("LAZY_A_FULL_TAIL_Ω"));
  assert(!JSON.stringify(snapshot).includes("LAZY_B_FULL_TAIL_Ω"), "plugin renderers cannot leak closed full output");
  assert(!JSON.stringify(snapshot).includes("LAZY_DETAIL_FULL_TAIL"));
  const small = resultOf(snapshot.messages, ids.small);
  assert.equal(small.outputPreview, undefined);
  assert.equal(text(small), smallOutput);
  assert.deepEqual(small.details, { intact: true });
  const smallCall = callsOf(snapshot.messages).find((call) => call.id === ids.small);
  assert.equal(smallCall.inputPreview, undefined);
  assert.deepEqual(smallCall.arguments, { code: "small input" });
  const start = events.find((event) => event.details?.sdkType === "tool_execution_start" && event.details?.toolCallId === ids.a);
  preview(start?.details?.inputPreview, inputA, "live input");
  assert.deepEqual(start.details.args, {});
  for (const [id, full] of [[ids.a, outputA], [ids.b, outputB]]) {
    const end = events.find((event) => event.details?.sdkType === "tool_execution_end" && event.details?.toolCallId === id);
    preview(end?.details?.outputPreview, full, "live completed output");
    assert.equal(text(end.details.result), end.details.outputPreview.preview);
    assert.equal(end.details.result.outputPreview.version, end.details.outputPreview.version);
    assert(!JSON.stringify(end).includes("LAZY_DETAIL_FULL_TAIL"));
  }
  const smallEnd = events.find((event) => event.details?.sdkType === "tool_execution_end" && event.details?.toolCallId === ids.small);
  assert.equal(smallEnd.details.outputPreview, undefined);
  assert.equal(text(smallEnd.details.result), smallOutput);
  assert.deepEqual(smallEnd.details.result.details, { intact: true });
  const smallStart = events.find((event) => event.details?.sdkType === "tool_execution_start" && event.details?.toolCallId === ids.small);
  assert.equal(smallStart.details.inputPreview, undefined);
  assert.deepEqual(smallStart.details.args, { code: "small input" });
  for (const marker of ["LAZY_INPUT_FULL_TAIL_Ω", "LAZY_A_FULL_TAIL_Ω", "LAZY_B_FULL_TAIL_Ω", "LAZY_DETAIL_FULL_TAIL"]) {
    assert(!JSON.stringify(events).includes(marker), `no live message/event bypasses projection: ${marker}`);
  }
  const fullA = await fetchFull(ids.a), fullB = await fetchFull(ids.b), fullEdit = await fetchFull(ids.edit);
  assert.deepEqual(fullA.args, largeArgs);
  assert.equal(text(fullA.result), outputA);
  assert.equal(text(fullB.result), outputB);
  assert.equal(fullA.result.details.marker, "LAZY_DETAIL_FULL_TAIL");
  assert.equal(fullA.result.details.payload.length, 10000);
  assert.equal(fullA.inputVersion, largeCall.inputPreview.version);
  assert.equal(fullA.outputVersion, projectedA.outputPreview.version);
  assert.notEqual(fullA.outputVersion, inFlight.outputVersion, "a final result cannot alias its cached partial version");
  assert.equal((await http(contentPath("missing/call?"))).status, 404);
  assert.equal((await http(`${contentPath(ids.a)}&sessionId=00000000-0000-4000-8000-000000000000`)).status, 400, "the removed session selector is rejected");
  assert.equal((await http(`tool-content?${new URLSearchParams({ toolCallId: ids.a })}`)).status, 200, "the worker route identifies the session");
  assert.deepEqual(await client.request("toolContent", { sessionId: name, toolCallId: ids.a }), fullA, "wire and HTTP return the same full value");
  const saved = (await SessionManager.list(root, historyDir)).find((entry) => entry.id === sessionId);
  assert(saved, "real SDK JSONL session was persisted");
  const manager = SessionManager.open(saved.path, historyDir, root);
  const authoritative = manager.buildSessionContext().messages;
  assert.equal(text(resultOf(authoritative, ids.a)), outputA);
  assert.equal(text(resultOf(authoritative, ids.b)), outputB);
  assert.deepEqual(callsOf(authoritative).find((call) => call.id === ids.a).arguments, largeArgs);
  assert.equal(resultOf(authoritative, ids.a).outputPreview, undefined, "lazy transport metadata never mutates SDK history");
  assert((await readFile(saved.path, "utf8")).includes("LAZY_A_FULL_TAIL_Ω"), "JSONL retains the full result");
  const lastModelContext = contexts.at(-1).messages;
  assert.equal(text(resultOf(lastModelContext, ids.a)), outputA, "the provider still receives the complete first output");
  assert.equal(text(resultOf(lastModelContext, ids.b)), outputB);
  assert.deepEqual(callsOf(lastModelContext).find((call) => call.id === ids.a).arguments, largeArgs);
  for (const format of ["jsonl", "html"]) {
    const exported = await client.request("nativeAction", { sessionId: name, requestId: `lazy-export-${format}`, action: "export", args: { format } });
    assert.equal(exported.status, "completed");
    const entries = format === "jsonl" ? exported.data.content.trim().split("\n").map((line) => JSON.parse(line))
      : JSON.parse(Buffer.from(await page.evaluate((html) => new DOMParser().parseFromString(html, "text/html").getElementById("session-data").textContent, exported.data.content), "base64").toString("utf8")).entries;
    const messages = entries.filter((entry) => entry.type === "message").map((entry) => entry.message);
    assert.equal(text(resultOf(messages, ids.a)), outputA, `${format} export retains complete output A`);
    assert.equal(text(resultOf(messages, ids.b)), outputB, `${format} export retains complete output B`);
  }
  const baselineBytes = bytes(JSON.stringify({ ...snapshot, messages: authoritative }));
  const projectedBytes = bytes(JSON.stringify(snapshot));
  assert(baselineBytes > 260000 && projectedBytes < baselineBytes / 3, "representative ~260KB outputs leave the initial snapshot");
  console.log(JSON.stringify({ baselineSnapshotBytes: baselineBytes, projectedSnapshotBytes: projectedBytes, outputTextBytes: bytes(outputA) + bytes(outputB) }));
  return { snapshot, fullA, fullEdit };
}
