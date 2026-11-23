
export function activeOperation(ctx) { return ctx.state.session.snapshot?.operation || null; }

