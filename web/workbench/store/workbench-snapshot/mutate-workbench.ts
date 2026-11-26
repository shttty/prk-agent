import type { StoreContext } from "../store-context-types.ts";
import type { WorkbenchPendingKey } from "../store-types.ts";
import { sessionRequestCurrent } from "../selection/session-request-current.ts";
import { patch } from "../updates/patch.ts";
import { withPending } from "../updates/with-pending.ts";
import { normalizeSession } from "../../payloads/normalize-session.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { isOkReply } from "../../payloads/is-ok-reply.ts";
import { applyWorkbenchSnapshot } from "./apply-workbench-snapshot.ts";
import { setNotice } from "../notices/set-notice.ts";
import { setError } from "../notices/set-error.ts";
import { setBanner } from "../notices/set-banner.ts";

/** Run a workbench mutation under its pending flag and apply what it answers; resolves true when the Gateway confirmed it. */
export async function mutateWorkbench(ctx: StoreContext, flag: WorkbenchPendingKey, request: () => Promise<unknown>, notice: string | null, fallback: string, banner?: string): Promise<boolean> {
  const isCurrent = sessionRequestCurrent(ctx);
  patch(ctx, { session: { ...ctx.state.session, error: null }, pending: withPending(ctx.state.pending, flag, true) });
  try {
    // Session POSTs confirm with `{ok}` or the changed row (the collection event updates every page, this one included).
    // Instance add/edit/delete/reload answer with the whole workbench: instance changes have no collection event.
    const result = await request();
    const row = normalizeSession(result);
    if (row) patch(ctx, { sessions: new Map(ctx.state.sessions).set(row.sessionId, row) });
    else if (isRecord(result) && Array.isArray(result.targets) && Array.isArray(result.sessions)) applyWorkbenchSnapshot(ctx, result);
    else if (!isOkReply(result)) throw new Error(fallback);
    if (notice && isCurrent()) setNotice(ctx, notice, "notice");
    return true;
  } catch (error) {
    if (!isCurrent()) return false;
    setError(ctx, error instanceof Error ? error.message : fallback);
    if (banner) setBanner(ctx, banner, "error");
    return false;
  } finally { patch(ctx, { pending: withPending(ctx.state.pending, flag, false) }); }
}
