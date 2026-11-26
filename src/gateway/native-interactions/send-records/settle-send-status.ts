import { processStreamId } from "../../../sessions/host/host-stream-state.ts";
import type { SendRecords, SendStatus } from "./send-record-types.ts";
import { rememberSend } from "./remember-send.ts";
import { sessionSendRecords } from "./session-send-records.ts";

/**
 * What became of one send requestId. An in-flight send is awaited. A requestId this process never saw is withdrawn, so
 * it can no longer be admitted and "refused" stays true; that holds only when the sender's stream belongs to this
 * process (an earlier process may have admitted it) and no record of the session was evicted.
 */
export async function settleSendStatus(records: SendRecords, sessionId: string, requestId: string, streamId: string): Promise<SendStatus> {
  const log = sessionSendRecords(records, sessionId);
  let record = log.entries.get(requestId);
  while (record?.state === "pending") {
    await record.settled;
    record = log.entries.get(requestId);
  }
  if (record?.state === "accepted") return { requestId, status: "accepted", operationId: record.operationId };
  if (record?.state === "handled") return { requestId, status: "handled" };
  if (record) return { requestId, status: "refused" };
  if (!streamId.startsWith(`${processStreamId}:`) || log.evicted) return { requestId, status: "unknown" };
  rememberSend(log, requestId, { state: "withdrawn" });
  return { requestId, status: "refused" };
}
