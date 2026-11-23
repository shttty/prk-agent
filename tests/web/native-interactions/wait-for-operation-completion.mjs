

export async function waitForOperationCompletion(ctx, page, sessionId, operationId) {
    await ctx.waitForObservation(page, async ({ sessionId, expectedId }) => {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        if (!response.ok) return false;
        const value = await response.json();
        if (value?.operation?.operationId === expectedId) return false;
        return value?.recentOperations?.some((operation) => operation?.operationId === expectedId && ["completed", "failed", "cancelled", "canceled", "unknown"].includes(operation.status)) === true;
      } catch { return false; }
    }, { sessionId: sessionId, expectedId: operationId }, { timeout: 30_000 });
  }
