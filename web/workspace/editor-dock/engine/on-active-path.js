
export function onActivePath(ctx, listener) { ctx.activeListeners.add(listener); return () => ctx.activeListeners.delete(listener); }
