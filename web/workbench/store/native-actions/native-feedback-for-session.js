export function nativeFeedbackForSession(ctx, entries) {
    return entries.filter((entry) => entry.action !== "reference-candidates" && (!entry.sessionId || entry.sessionId === ctx.state.selectedSessionId));
  }

