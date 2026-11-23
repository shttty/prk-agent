
export function subscribe(ctx, listener) { ctx.listeners.add(listener); return () => ctx.listeners.delete(listener); }
