
export function notifyStorageFailure(ctx, message) {
    if (ctx.storageWarningShown) return;
    ctx.storageWarningShown = true;
    if (typeof ctx.onStorageFailure === "function") ctx.onStorageFailure(message);
  }

