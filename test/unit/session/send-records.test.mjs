import assert from "node:assert/strict";
import test from "node:test";
import { trackSend } from "../../../src/gateway/native-interactions/send-records/track-send.ts";
import { settleSendStatus } from "../../../src/gateway/native-interactions/send-records/settle-send-status.ts";
import { SEND_RECORDS_PER_SESSION } from "../../../src/gateway/native-interactions/send-records/send-record-types.ts";
import { processStreamId } from "../../../src/sessions/host/host-stream-state.ts";

const stream = `${processStreamId}:host`;

test("a send status query reports admission and withdraws a requestId this Gateway never saw", async () => {
  const records = new Map();
  let runs = 0;
  const admit = () => { runs += 1; return Promise.resolve({ accepted: true, requestId: "a", operationId: "op" }); };
  await trackSend(records, "s", "a", admit);
  assert.deepEqual(await settleSendStatus(records, "s", "a", stream), { requestId: "a", status: "accepted", operationId: "op" });
  assert.equal((await trackSend(records, "s", "a", admit)).accepted, false, "an admitted requestId is not run twice");
  assert.deepEqual(await settleSendStatus(records, "s", "lost", stream), { requestId: "lost", status: "refused" });
  const late = await trackSend(records, "s", "lost", admit);
  assert.equal(late.accepted, false, "a withdrawn requestId arriving late is never admitted");
  assert.equal(runs, 1);
  await trackSend(records, "s", "slash", () => Promise.resolve({ requestId: "slash", action: "name", status: "completed" }));
  assert.equal((await settleSendStatus(records, "s", "slash", stream)).status, "handled");
});

test("an in-flight send is awaited; a refusal or thrown failure is final but retryable", async () => {
  const records = new Map();
  const gate = Promise.withResolvers();
  const inFlight = trackSend(records, "s", "slow", () => gate.promise);
  const status = settleSendStatus(records, "s", "slow", stream);
  gate.resolve({ accepted: true, requestId: "slow", operationId: "op" });
  await inFlight;
  assert.equal((await status).status, "accepted");
  await assert.rejects(trackSend(records, "s", "wake", () => Promise.reject(new Error("wake failed"))));
  assert.equal((await settleSendStatus(records, "s", "wake", stream)).status, "refused");
  await trackSend(records, "s", "busy", () => Promise.resolve({ accepted: false, requestId: "busy", error: "busy" }));
  assert.equal((await trackSend(records, "s", "busy", () => Promise.resolve({ accepted: true, requestId: "busy", operationId: "op2" }))).accepted, true);
});

test("an unseen requestId stays unknown when another Gateway process may have taken it or records were evicted", async () => {
  const records = new Map();
  assert.equal((await settleSendStatus(records, "s", "x", "earlier-process:host")).status, "unknown");
  for (let index = 0; index <= SEND_RECORDS_PER_SESSION; index += 1) {
    await trackSend(records, "busy", `r${index}`, () => Promise.resolve({ accepted: true, requestId: `r${index}`, operationId: "op" }));
  }
  assert.equal((await settleSendStatus(records, "busy", "r0", stream)).status, "unknown");
  assert.equal((await settleSendStatus(records, "busy", `r${SEND_RECORDS_PER_SESSION}`, stream)).status, "accepted");
});
