import type { NativeReferenceCandidate } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { patchSession } from "../updates/patch-session.ts";
import { referenceError } from "./reference-error.ts";
import { postJson } from "../requests/post-json.ts";
import { RequestError } from "../requests/request-error.ts";
import { nativePath } from "../native-actions/native-path.ts";
import { requestId } from "../requests/request-id.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { safeText } from "../../payloads/safe-text.ts";

export async function loadReferenceCandidates(ctx: StoreContext, path = ""): Promise<NativeReferenceCandidate[]> {
  const name = ctx.state.selectedSessionId;
  const sessionRow = name ? ctx.state.sessions.get(name) : null;
  const token = ++ctx.referenceRequestToken;
  if (!name) {
    patchSession(ctx, { referenceCandidates: { value: [], truncated: false, loading: false, error: null } });
    return [];
  }
  if (!sessionRow?.target) {
    patchSession(ctx, { referenceCandidates: { value: [], truncated: false, loading: false, error: referenceError("missing-target") } });
    return [];
  }
  patchSession(ctx, { referenceCandidates: { value: [], truncated: false, loading: true, error: null } });
  try {
    const result = await postJson(nativePath(ctx, name), { requestId: requestId(), action: "reference-candidates", args: { target: sessionRow.target, sessionId: name, path } });
    if (token !== ctx.referenceRequestToken || ctx.state.selectedSessionId !== name) return [];
    if (!isRecord(result) || safeText(result.status) !== "completed") throw new Error(isRecord(result) ? safeText(result.message) : "");
    const data = isRecord(result.data) ? result.data : {};
    const { candidates, truncated } = data;
    if (!Array.isArray(candidates) || typeof truncated !== "boolean") throw new Error("服务未返回有效的引用候选。");
    // The Gateway builds the candidates; the list is taken as sent.
    const value = candidates as NativeReferenceCandidate[];
    patchSession(ctx, { referenceCandidates: { value, truncated, loading: false, error: null } });
    return value;
  } catch (error) {
    // The Gateway names why (details.reason); the menu shows it in place, never as a banner.
    if (token === ctx.referenceRequestToken && ctx.state.selectedSessionId === name) {
      const reason = error instanceof RequestError ? safeText(error.details?.reason) : "";
      patchSession(ctx, { referenceCandidates: { value: [], truncated: false, loading: false, error: referenceError(reason, error instanceof Error ? error.message : "") } });
    }
    return [];
  }
}
