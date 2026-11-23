

export async function waitForIdle(ctx, page, sessionId, expectedOperationId = null) {
    await ctx.waitForObservation(page, async ({ sessionId, expectedId }) => {
      try {
        const stateResponse = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
        if (!stateResponse.ok) return false;
        const current = await stateResponse.json();
        if (current?.state !== "idle" || current?.operation) return false;
        if (expectedId && Array.isArray(current?.recentOperations)
          && current.recentOperations.some((operation) => operation?.operationId === expectedId
            && ["completed", "failed", "cancelled", "canceled", "unknown"].includes(operation.status)) !== true) return false;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const secondResponse = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
        if (!secondResponse.ok) return false;
        const second = await secondResponse.json();
        return second?.state === "idle" && !second?.operation
          && (!expectedId || !Array.isArray(second?.recentOperations)
            || second.recentOperations.some((operation) => operation?.operationId === expectedId
              && ["completed", "failed", "cancelled", "canceled", "unknown"].includes(operation.status)) === true);
      } catch { return false; }
    }, { sessionId: sessionId, expectedId: expectedOperationId }, { timeout: 30_000 });
  }
