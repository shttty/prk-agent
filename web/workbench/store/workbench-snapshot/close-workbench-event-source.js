
export function closeWorkbenchEventSource(ctx) {
    if (ctx.workbenchSource) ctx.workbenchSource.close();
    ctx.workbenchSource = null;
  }

