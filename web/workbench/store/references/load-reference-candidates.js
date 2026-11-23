import { patchSession } from "../updates/patch-session.js";
import { referenceError } from "./reference-error.js";
import { postJson } from "../requests/post-json.js";
import { nativePath } from "../native-actions/native-path.js";
import { requestId } from "../requests/request-id.js";
import { safeText } from "../../payloads/safe-text.js";
export async function loadReferenceCandidates(ctx, path = "") {
    const name = ctx.state.selectedSessionId;
    const sessionRow = name ? ctx.state.sessions.get(name) : null;
    const token = ++ctx.referenceRequestToken;
    if (!name || typeof path !== "string") {
      patchSession(ctx, { referenceCandidates: { value: [], truncated: false, loading: false, error: null } });
      return [];
    }
    if (!sessionRow?.target) {
      patchSession(ctx, { referenceCandidates: { value: [], truncated: false, loading: false, error: referenceError("missing-target") } });
      return [];
    }
    patchSession(ctx, { referenceCandidates: { value: [], truncated: false, loading: true, error: null } });
    try {
      const result = await postJson(ctx, nativePath(ctx, name), { requestId: requestId(), action: "reference-candidates", args: { target: sessionRow.target, sessionId: name, path } });
      if (token !== ctx.referenceRequestToken || !(ctx.state.selectedSessionId === name)) return [];
      if (safeText(result?.status) !== "completed") throw new Error(safeText(result?.message));
      const { candidates, truncated } = result.data ?? {};
      if (!Array.isArray(candidates) || typeof truncated !== "boolean") throw new Error("服务未返回有效的引用候选。");
      patchSession(ctx, { referenceCandidates: { value: candidates, truncated, loading: false, error: null } });
      return candidates;
    } catch (error) {
      // The Gateway names why (details.reason); the menu shows it in place, never as a banner.
      if (token === ctx.referenceRequestToken && ctx.state.selectedSessionId === name) patchSession(ctx, { referenceCandidates: { value: [], truncated: false, loading: false, error: referenceError(safeText(error?.details?.reason), error instanceof Error ? error.message : "") } });
      return [];
    }
  }

