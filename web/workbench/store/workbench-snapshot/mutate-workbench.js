import { sessionRequestCurrent } from "../selection/session-request-current.js";
import { patch } from "../updates/patch.js";
import { withPending } from "../updates/with-pending.js";
import { normalizeSession } from "../../payloads/normalize-session.js";
import { isRecord } from "../../payloads/is-record.js";
import { applyWorkbenchSnapshot } from "./apply-workbench-snapshot.js";
import { setNotice } from "../notices/set-notice.js";
import { setError } from "../notices/set-error.js";
import { setBanner } from "../notices/set-banner.js";
export async function mutateWorkbench(ctx, flag, request, notice, fallback, banner) {
    const isCurrent = sessionRequestCurrent(ctx);
    patch(ctx, { session: { ...ctx.state.session, error: null }, pending: withPending(ctx.state.pending, flag, true) });
    try {
      // Session POSTs confirm with `{ok}` or the changed row (the collection event updates every page, this one included).
      // Instance add/edit/delete/reload answer with the whole workbench: instance changes have no collection event.
      const result = await request();
      const row = normalizeSession(result);
      if (row) patch(ctx, { sessions: new Map(ctx.state.sessions).set(row.sessionId, row) });
      else if (isRecord(result) && Array.isArray(result.targets) && Array.isArray(result.sessions)) applyWorkbenchSnapshot(ctx, result);
      else if (result?.ok !== true) throw new Error(fallback);
      if (notice && isCurrent()) setNotice(ctx, notice, "notice");
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      setError(ctx, error instanceof Error ? error.message : fallback);
      if (banner) setBanner(ctx, banner, "error");
      return false;
    } finally { patch(ctx, { pending: withPending(ctx.state.pending, flag, false) }); }
  }

