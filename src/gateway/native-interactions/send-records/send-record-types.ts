/** What this Gateway process did with one send requestId; kept in memory for the life of the process. */
export type SendRecord =
  | { readonly state: "pending"; readonly settled: Promise<void> }
  | { readonly state: "accepted"; readonly operationId: string }
  | { readonly state: "handled" }
  | { readonly state: "refused" }
  | { readonly state: "withdrawn" };

export interface SessionSendRecords {
  readonly entries: Map<string, SendRecord>;
  /** Once an entry was dropped, an unseen requestId is no longer proof that it never arrived. */
  evicted: boolean;
}

export type SendRecords = Map<string, SessionSendRecords>;

export type SendStatus =
  | { readonly requestId: string; readonly status: "accepted"; readonly operationId: string }
  | { readonly requestId: string; readonly status: "handled" | "refused" | "unknown" };

export const SEND_RECORDS_PER_SESSION = 1024;
