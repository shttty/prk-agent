
export function sessionRequestCurrent(ctx) {
    const token = ctx.selectionToken;
    const streamId = ctx.state.session.streamId;
    return () => !ctx.disposed && token === ctx.selectionToken && streamId === ctx.state.session.streamId;
  }

