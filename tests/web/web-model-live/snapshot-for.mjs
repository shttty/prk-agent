

export async function snapshotFor(ctx, page, sessionId) {
  return ctx.browserJson(page, `/api/sessions/${encodeURIComponent(sessionId)}`);
}
