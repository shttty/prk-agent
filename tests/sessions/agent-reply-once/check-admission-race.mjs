import assert from "node:assert/strict";
import { createMessagingTools } from "../../../src/plugins/sessions/tools/create-messaging-tools.ts";
import { DEFAULT_DERIVED_SCHEMAS } from "../../../src/plugins/sessions/default-schema.ts";

export async function checkAdmissionRace(createAgentMessaging, parsePrkConfig, alreadyAnswered) {
  // The asynchronous admission race uses the actual application tool execute path.
  // Only admission is controlled here; primary reply/routing/retention cases above use a real Gateway + SDK loop.
  let pendingAdmission = Promise.withResolvers();
  const attempts = [];
  let holdFirst = true;
  const messaging = createAgentMessaging({
    list: () => ["race-a", "race-b", "race-c"].map((name) => ({ sessionId: name, label: name, state: "idle" })),
    async deliver(to, entry) {
      attempts.push({ to, messageId: entry.messageId });
      if (holdFirst) {
        holdFirst = false;
        return pendingAdmission.promise;
      }
      return { accepted: true, pending: 0, delivery: "delivered" };
    },
  }, parsePrkConfig({ session: { rememberedRepliesMax: 1 } }).session);
  const execute = (actor, replyTo, to = "race-b") => createMessagingTools({
    schemas: DEFAULT_DERIVED_SCHEMAS, sessionOptions: parsePrkConfig({ session: { rememberedRepliesMax: 1 } }).session,
    list: () => messaging.list().filter((peer) => peer.sessionId !== actor), send: (request) => messaging.send(actor, request),
  }).find((tool) => tool.name === "session_send").execute(`race-${actor}-${replyTo}`, { to, message: "Controlled reply admission", replyTo });
  const inFlight = execute("race-a", "pending-reply");
  await assert.rejects(execute("race-c", "pending-reply", "race-a"), alreadyAnswered);
  assert.equal(attempts.length, 1, "Concurrent duplicate never enters recipient admission");
  await execute("race-a", "settled-reply-one");
  await execute("race-c", "settled-reply-two");
  await assert.rejects(execute("race-c", "pending-reply", "race-a"), alreadyAnswered);
  assert.equal(attempts.length, 3, "Small remembered cap never evicts an in-flight association");
  const failureObserved = assert.rejects(inFlight, /controlled admission refused/);
  pendingAdmission.reject(new Error("controlled admission refused"));
  await failureObserved;
  await execute("race-c", "pending-reply", "race-a");
  assert.equal(attempts.length, 4, "Failed asynchronous admission releases the reply association for retry");
  await assert.rejects(execute("race-a", "pending-reply"), alreadyAnswered);
  assert.equal(attempts.length, 4, "Only the accepted retry consumes the reply slot");
  pendingAdmission = Promise.withResolvers();
  holdFirst = true;
  const acceptedInFlight = execute("race-a", "pending-success");
  await assert.rejects(execute("race-c", "pending-success", "race-a"), alreadyAnswered);
  assert.equal(attempts.length, 5, "Concurrent duplicate is refused while successful admission awaits");
  pendingAdmission.resolve({ accepted: true, pending: 0, delivery: "delivered" });
  await acceptedInFlight;
  await assert.rejects(execute("race-c", "pending-success", "race-a"), alreadyAnswered);
  assert.equal(attempts.length, 5, "Accepted asynchronous admission keeps its reply slot after settling");
}
