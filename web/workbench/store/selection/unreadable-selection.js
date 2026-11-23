/** Whether the selected native session is reported as unreadable; file-only diagnostics match nothing. */
export function unreadableSelection(ctx, issues) {
  const name = ctx.state.selectedSessionId;
  if (!name) return false;
  return issues.some((issue) => issue.sessionId === name);
}
