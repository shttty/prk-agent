import type { StoredAttachment, StoredReference } from "../../session-storage/session-storage-types.ts";
import type { WorkbenchState } from "../store-types.ts";

export type SendQueue = WorkbenchState["queue"];

/** What a send is made of besides its text; unset attachments and references are the composer's current ones. */
export type SendOptions = { queue?: SendQueue; attachments?: StoredAttachment[]; references?: StoredReference[]; mode?: "plain" | "auto" };
export type ResolvedSendOptions = { attachments: StoredAttachment[]; references: StoredReference[]; mode?: "plain" | "auto" };

/** The Gateway's answer to "what became of this requestId" for a send whose reply was lost. */
export type SendStatus = "accepted" | "handled" | "refused" | "unknown";

/** A whole-turn stop (no `cell`) or a directed stop of one live cell (`cellOnly`) of the selected session's current stream. */
export type StopTarget = {
  sessionId: string;
  streamId: string | null;
  operationId?: string;
  cell?: { kernelId: string; cellId: string };
  cellOnly?: boolean;
};
