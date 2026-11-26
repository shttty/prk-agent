import { object } from "../../wire/is-record.ts";
import type { SendRecord, SendRecords } from "./send-record-types.ts";
import { rememberSend } from "./remember-send.ts";
import { sessionSendRecords } from "./session-send-records.ts";

/**
 * Run one send under its requestId record. A requestId that was withdrawn, is in flight or was already answered is
 * not run again; only a refused one may be retried.
 */
export async function trackSend(records: SendRecords, sessionId: string, requestId: string, send: () => Promise<unknown>): Promise<unknown> {
  const log = sessionSendRecords(records, sessionId);
  const prior = log.entries.get(requestId);
  if (prior?.state === "withdrawn") return { accepted: false, requestId, error: "requestId was withdrawn by a send status query; send again with a new requestId." };
  if (prior && prior.state !== "refused") return { accepted: false, requestId, error: "requestId was already submitted; do not replay." };
  const settled = Promise.withResolvers<void>();
  rememberSend(log, requestId, { state: "pending", settled: settled.promise });
  try {
    const result = await send();
    rememberSend(log, requestId, outcome(result));
    return result;
  } catch (error) {
    // Send throws only before input admission (runtime start, wake, input preparation); nothing reached the SDK.
    rememberSend(log, requestId, { state: "refused" });
    throw error;
  } finally {
    settled.resolve();
  }
}

function outcome(result: unknown): SendRecord {
  // Native command results carry no `accepted` field: the command was answered, not admitted as input.
  if (!object(result) || typeof result.accepted !== "boolean") return { state: "handled" };
  return result.accepted && typeof result.operationId === "string" ? { state: "accepted", operationId: result.operationId } : { state: "refused" };
}
