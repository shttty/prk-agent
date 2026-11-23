
export function sessionStorageKey(ctx, sessionId) {
    return `${ctx.storageNamespace}:session:${encodeURIComponent(sessionId)}`;
  }

