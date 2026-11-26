import type { StoreContext } from "../store-context-types.ts";
import { sessionRequestCurrent } from "../selection/session-request-current.ts";
import { postJson } from "../requests/post-json.ts";
import { nativePath } from "./native-path.ts";
import { requestId } from "../requests/request-id.ts";
import { nativeActionResult } from "./native-action-result.ts";
import { isRecord } from "../../payloads/is-record.ts";

/** The data of a read-only native action, or null when it did not complete or the page moved on. `Data` is the caller's statement of that action's contract. */
export async function nativeData<Data extends Record<string, unknown> = Record<string, unknown>>(ctx: StoreContext, action: string, args: Record<string, unknown> = {}): Promise<Data | null> {
  const name = ctx.state.selectedSessionId;
  if (!name) return null;
  const isCurrent = sessionRequestCurrent(ctx);
  try {
    const result = await postJson(nativePath(ctx, name), { requestId: requestId(), action, args });
    if (!isCurrent() || !nativeActionResult(result) || result.status !== "completed") return null;
    // External input boundary: the action's data is taken as sent.
    const data: Record<string, unknown> = isRecord(result.data) ? result.data : {};
    return data as Data;
  } catch {
    return null;
  }
}
