import type { StoreContext } from "../store-context-types.ts";
import { sessionRequestCurrent } from "../selection/session-request-current.ts";
import { postJson } from "../requests/post-json.ts";
import { nativePath } from "./native-path.ts";
import { requestId } from "../requests/request-id.ts";
import { nativeActionResult } from "./native-action-result.ts";
import { isRecord } from "../../payloads/is-record.ts";

/** The data of a read-only native action, or null when it did not complete or the page moved on. */
export async function nativeData(ctx: StoreContext, action: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown> | null> {
  const name = ctx.state.selectedSessionId;
  if (!name) return null;
  const isCurrent = sessionRequestCurrent(ctx);
  try {
    const result = await postJson(nativePath(ctx, name), { requestId: requestId(), action, args });
    if (!isCurrent() || !nativeActionResult(result) || result.status !== "completed") return null;
    return isRecord(result.data) ? result.data : {};
  } catch {
    return null;
  }
}
