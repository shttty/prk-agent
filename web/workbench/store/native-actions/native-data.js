import { sessionRequestCurrent } from "../selection/session-request-current.js";
import { postJson } from "../requests/post-json.js";
import { nativePath } from "./native-path.js";
import { requestId } from "../requests/request-id.js";
import { nativeActionResult } from "./native-action-result.js";
import { isRecord } from "../../payloads/is-record.js";
export async function nativeData(ctx, action, args = {}) {
    const name = ctx.state.selectedSessionId;
    if (!name) return null;
    const isCurrent = sessionRequestCurrent(ctx);
    try {
      const result = await postJson(ctx, nativePath(ctx, name), { requestId: requestId(), action, args });
      if (!isCurrent() || !nativeActionResult(ctx, result) || result.status !== "completed") return null;
      return isRecord(result.data) ? result.data : {};
    } catch {
      return null;
    }
  }

