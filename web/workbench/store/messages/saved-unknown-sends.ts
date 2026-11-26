import type { SavedSessionState } from "../../session-storage/session-storage-types.ts";
import type { LocalMessage } from "../store-types.ts";

/** The sends whose result was unknown when this session's state was last saved, as composer receipts again. */
export function savedUnknownSends(saved: Pick<SavedSessionState, "unknownSends"> | null): Map<string, LocalMessage> {
  return new Map((saved?.unknownSends ?? []).map(([requestId, entry]) => [requestId, { status: "unknown", ...entry }]));
}
