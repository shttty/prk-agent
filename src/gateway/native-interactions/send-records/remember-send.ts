import { SEND_RECORDS_PER_SESSION, type SendRecord, type SessionSendRecords } from "./send-record-types.ts";

export function rememberSend(log: SessionSendRecords, requestId: string, record: SendRecord): void {
  log.entries.delete(requestId);
  log.entries.set(requestId, record);
  if (log.entries.size <= SEND_RECORDS_PER_SESSION) return;
  log.entries.delete(log.entries.keys().next().value as string);
  log.evicted = true;
}
