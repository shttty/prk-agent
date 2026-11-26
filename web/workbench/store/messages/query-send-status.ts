import type { StoreContext } from "../store-context-types.ts";
import type { SendStatus } from "./message-types.ts";
import { postJson } from "../requests/post-json.ts";
import { isRecord } from "../../payloads/is-record.ts";

const STATUSES: readonly string[] = ["accepted", "handled", "refused", "unknown"];

/** The Gateway's record of a requestId; null when it answered with something else. */
export async function querySendStatus(ctx: StoreContext, sessionId: string, requestId: string, streamId: string | null): Promise<SendStatus | null> {
  const result = await postJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(sessionId)}/send-status`, { requestId, streamId });
  const status = isRecord(result) ? STATUSES.find((candidate) => candidate === result.status) : undefined;
  return status ? status as SendStatus : null;
}
