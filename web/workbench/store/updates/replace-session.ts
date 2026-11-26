import type { StoreContext } from "../store-context-types.ts";
import type { SelectedSessionState, WorkbenchState } from "../store-types.ts";
import { patch } from "./patch.ts";
import { initialSession } from "../initial-session.ts";

export function replaceSession(ctx: StoreContext, streamId: string | null = null, sessionPatch: Partial<SelectedSessionState> | null = null, statePatch: Partial<WorkbenchState> | null = null) {
  clearTimeout(ctx.renderTimer);
  ctx.renderTimer = undefined;
  ctx.renderPending = null;
  ctx.renderFlight = null;
  ctx.renderStartedAt = 0;
  ctx.toolContentRequests.clear();
  ++ctx.referenceRequestToken;
  patch(ctx, { ...statePatch, session: { ...initialSession(streamId), ...sessionPatch } });
}
