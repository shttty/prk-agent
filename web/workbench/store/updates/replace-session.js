import { patch } from "./patch.js";
import { initialSession } from "../initial-session.js";
export function replaceSession(ctx, streamId = null, sessionPatch = null, statePatch = null) {
    clearTimeout(ctx.renderTimer);
    ctx.renderTimer = null;
    ctx.renderPending = null;
    ctx.renderFlight = null;
    ctx.renderStartedAt = 0;
    ctx.toolContentRequests.clear();
    ++ctx.referenceRequestToken;
    patch(ctx, { ...statePatch, session: { ...initialSession(streamId), ...sessionPatch } });
  }

