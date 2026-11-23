import type { UiContext } from "../ui-types.ts";

export function currentNotificationAnchor(ctx: UiContext) { return ({
    sessionId: ctx.session.sessionManager.getSessionId(),
    anchorEntryId: ctx.session.sessionManager.getLeafId(),
    position: ctx.session.messages.length,
    messageOffset: ctx.session.messages.length - ctx.session.sessionManager.buildSessionProjection().messages.length,
  }); }
