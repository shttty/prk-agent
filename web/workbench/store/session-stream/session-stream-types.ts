import type { SessionHostSnapshot } from "../../../../src/gateway/wire/web-types.ts";

/** One page of earlier history (`GET /sessions/:id/history-page`): messages with their entry ids and the next cursor. */
export type HistoryPage = {
  messages: SessionHostSnapshot["messages"];
  messageEntryIds: string[];
  historyBefore: string | null;
  historyForkBefore: string | null;
  compactions: NonNullable<SessionHostSnapshot["compactions"]>;
  compactionEntryIds: string[];
};

/** The fields of a `state_changed` event that move the snapshot; a key is present only when the event carried it. */
export type StateChange = Partial<Pick<SessionHostSnapshot, "state" | "operation" | "kernel" | "kernelCells" | "terminals">>;
