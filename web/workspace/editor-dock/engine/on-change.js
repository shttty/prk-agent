
export function onChange(ctx, listener) { ctx.changeListeners.add(listener); return () => ctx.changeListeners.delete(listener); }
