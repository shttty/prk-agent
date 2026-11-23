
export function sessionPhase(ctx, name) {
    const selected = ctx.state.selectedSessionId === name;
    return [ctx.state.sessions.get(name), selected ? ctx.state.session.snapshot : null, selected ? ctx.state.session.streamId : null, selected ? ctx.state.session.connection : null];
  }


