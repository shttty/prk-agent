import type { StoreContext } from "../store-context-types.ts";
import type { SessionRow } from "../store-types.ts";
import type { CreateSessionPayload } from "./session-management-types.ts";
import { patch } from "../updates/patch.ts";
import { withPending } from "../updates/with-pending.ts";
import { postJson } from "../requests/post-json.ts";
import { RequestError } from "../requests/request-error.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { normalizeSnapshot } from "../../payloads/normalize-snapshot.ts";
import { normalizeSession } from "../../payloads/normalize-session.ts";
import { rowStateOf } from "../session-stream/row-state-of.ts";
import { selectSession } from "../selection/select-session.ts";
import { setNotice } from "../notices/set-notice.ts";
import { setError } from "../notices/set-error.ts";
import { setBanner } from "../notices/set-banner.ts";
import { applyTargetEnvironment } from "../targets/apply-target-environment.ts";
import { normalizeEnvironment } from "../../payloads/normalize-environment.ts";

export async function submitSessionCreation(ctx: StoreContext, payload: CreateSessionPayload): Promise<SessionRow | RequestError | false> {
  const selectedBefore = ctx.state.selectedSessionId;
  const tokenBefore = ctx.selectionToken;
  patch(ctx, { session: { ...ctx.state.session, error: null }, pending: withPending(ctx.state.pending, "creating", true) });
  try {
    const response = await postJson(`${ctx.apiRoot}/sessions`, payload);
    const snapshot = isRecord(response) ? normalizeSnapshot(response.snapshot) : null;
    const sessionRow = isRecord(response) ? normalizeSession(response.session) : null;
    if (!snapshot || !sessionRow) throw new Error("新会话未确认，请刷新列表。");
    const sessions = new Map(ctx.state.sessions).set(sessionRow.sessionId, { ...sessionRow, state: rowStateOf(snapshot.state) });
    patch(ctx, { sessions, pending: withPending(ctx.state.pending, "creating", false) });
    if (ctx.state.selectedSessionId === selectedBefore && ctx.selectionToken === tokenBefore) await selectSession(ctx, sessionRow.sessionId, { snapshot });
    setNotice(ctx, `已创建${sessionRow.label || "新会话"}。`, "notice");
    return sessionRow;
  } catch (error) {
    patch(ctx, { pending: withPending(ctx.state.pending, "creating", false) });
    // A definite refusal: the automatic environment deployment failed and nothing was created. The caller (the create
    // dialog) shows it with its retry; the environment it reports is merged under the stream/revision rule.
    if (error instanceof RequestError && error.code === "DEPLOYMENT_FAILED") {
      applyTargetEnvironment(ctx, normalizeEnvironment(error.details?.environment));
      return error;
    }
    // A session created despite the error reaches the list through its collection row event.
    setError(ctx, error instanceof Error ? error.message : "创建会话失败。");
    setBanner(ctx, "新会话未确认，请刷新列表。", "error");
    return false;
  }
}
