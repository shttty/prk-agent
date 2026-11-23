

export async function waitForRunning(ctx, page, sessionId) {
    return ctx.waitForObservation(page, async (sessionId) => {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        if (!response.ok) return null;
        const value = await response.json();
        if (!["running", "cancel_requested"].includes(value?.state)) return null;
        if (!["running", "cancel_requested"].includes(value?.operation?.state)) return null;
        return value.operation?.operationId ? value.operation : null;
      } catch { return null; }
    }, sessionId, { timeout: 30_000 });
  }
