import type { SendRecords, SessionSendRecords } from "./send-record-types.ts";

export function sessionSendRecords(records: SendRecords, sessionId: string): SessionSendRecords {
  let log = records.get(sessionId);
  if (!log) { log = { entries: new Map(), evicted: false }; records.set(sessionId, log); }
  return log;
}
