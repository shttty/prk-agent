

export function safeProcessRecord(ctx, handle) {
  if (!handle) return undefined;
  return {
    pid: handle.child.pid,
    exitCode: handle.child.exitCode,
    signalCode: handle.child.signalCode,
    exitedAt: handle.exitedAt,
  };
}
