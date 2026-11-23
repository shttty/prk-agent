
export function onPanelRemoved(ctx, listener) { ctx.removedListeners.add(listener); return () => ctx.removedListeners.delete(listener); }
