
export function dispose(ctx) { for (const subscription of ctx.subscriptions) subscription.dispose(); }
