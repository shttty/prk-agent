import { patch } from "../updates/patch.js";
import { withPending } from "../updates/with-pending.js";
import { postJson } from "../requests/post-json.js";
import { normalizeSnapshot } from "../../payloads/normalize-snapshot.js";
import { normalizeSession } from "../../payloads/normalize-session.js";
import { selectSession } from "../selection/select-session.js";
import { setNotice } from "../notices/set-notice.js";
import { setError } from "../notices/set-error.js";
import { setBanner } from "../notices/set-banner.js";
import { applyTargetEnvironment } from "../targets/apply-target-environment.js";
import { normalizeEnvironment } from "../../payloads/normalize-environment.js";
export async function submitSessionCreation(ctx, payload) {
    const selectedBefore = ctx.state.selectedSessionId;
    const tokenBefore = ctx.selectionToken;
    patch(ctx, { session: { ...ctx.state.session, error: null }, pending: withPending(ctx.state.pending, "creating", true) });
    try {
      const response = await postJson(ctx, `${ctx.apiRoot}/sessions`, payload);
      const snapshot = normalizeSnapshot(response?.snapshot);
      const sessionRow = normalizeSession(response?.session);
      if (!snapshot || !sessionRow) throw new Error("新会话未确认，请刷新列表。");
      const sessions = new Map(ctx.state.sessions).set(sessionRow.sessionId, { ...sessionRow, state: snapshot.state });
      patch(ctx, { sessions, pending: withPending(ctx.state.pending, "creating", false) });
      if (ctx.state.selectedSessionId === selectedBefore && ctx.selectionToken === tokenBefore) await selectSession(ctx, sessionRow.sessionId, { snapshot });
      setNotice(ctx, `已创建${sessionRow.label || "新会话"}。`, "notice");
      return sessionRow;
    } catch (error) {
      patch(ctx, { pending: withPending(ctx.state.pending, "creating", false) });
      // A definite refusal: the automatic environment deployment failed and nothing was created. The caller (the create
      // dialog) shows it with its retry; the environment it reports is merged under the stream/revision rule.
      if (error?.code === "DEPLOYMENT_FAILED") {
        applyTargetEnvironment(ctx, normalizeEnvironment(error.details?.environment));
        return error;
      }
      // A session created despite the error reaches the list through its collection row event.
      setError(ctx, error instanceof Error ? error.message : "创建会话失败。");
      setBanner(ctx, "新会话未确认，请刷新列表。", "error");
      return false;
    }
  }

