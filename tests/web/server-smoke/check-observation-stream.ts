import assert from "node:assert/strict";
import type { createGatewayFixture } from "../../fixtures/web-server-smoke/create-gateway-fixture.ts";

/**
 * Session SSE: the subscription snapshot comes first, host events follow unchanged, and terminal events
 * (message_end, operation_completed) start no Web-side state read — the Gateway pushes the post-operation snapshot.
 * Closing the stream releases its Gateway subscription.
 */
export async function checkObservationStream(
  fixture: ReturnType<typeof createGatewayFixture>, origin: string, primary: { sessionId: string },
): Promise<void> {
  const { record, requireSession } = fixture;
  const primaryWorker = requireSession(primary.sessionId);
  const events = await fetch(`${origin}/api/sessions/${encodeURIComponent(primary.sessionId)}/events`, { signal: AbortSignal.timeout(20_000) });
  assert.equal(events.status, 200);
  assert.match(events.headers.get("content-type") ?? "", /text\/event-stream/);
  const reader = events.body?.getReader();
  assert(reader);
  const decoder = new TextDecoder();
  let buffered = "";
  const nextFrame = async (): Promise<string> => {
    while (!buffered.includes("\n\n")) {
      const chunk = await reader.read();
      assert(!chunk.done, "SSE stream ended before the expected event");
      buffered += decoder.decode(chunk.value, { stream: true });
    }
    const end = buffered.indexOf("\n\n") + 2;
    const frame = buffered.slice(0, end);
    buffered = buffered.slice(end);
    return frame;
  };
  assert.match(await nextFrame(), /^event: snapshot\n/, "The first SSE frame is the authoritative snapshot");
  assert.equal(record.observe.at(-1), primary.sessionId);

  const statesBefore = record.stateAttempts;
  const emit = (event: Record<string, unknown>): void => {
    for (const sink of [...primaryWorker.sinks]) sink.event({ streamId: primaryWorker.streamId, sessionId: primaryWorker.sessionId, timestamp: new Date().toISOString(), ...event });
  };
  emit({ sequence: 2, type: "message", text: "partial" });
  emit({ sequence: 3, type: "session_event", details: { sdkType: "message_end" } });
  emit({ sequence: 4, type: "operation_completed", operationId: "operation-1" });
  for (const _ of [1, 2, 3]) assert.match(await nextFrame(), /^event: host\n/, "Live host events reach the browser");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(record.stateAttempts, statesBefore, "Terminal events start no Web-side snapshot read");

  const observationEndsBeforeClose = primaryWorker.observationEnds;
  await reader.cancel();
  const closeDeadline = Date.now() + 1_000;
  while (primaryWorker.observationEnds === observationEndsBeforeClose) {
    assert(Date.now() < closeDeadline, "The closed observer must release its Gateway subscription");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
