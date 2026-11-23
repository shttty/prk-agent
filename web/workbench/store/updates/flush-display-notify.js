
export function flushDisplayNotify(ctx) {
    ctx.displayNotifyCancel?.();
    ctx.displayNotifyCancel = null;
  }

