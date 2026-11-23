export function kill(ctx) {
  if (ctx.settled || ctx.killed) return;
  ctx.killed = true;
  ctx.child.kill("SIGTERM");
  ctx.forceKill = setTimeout(() => {
    if (ctx.child.exitCode === null && ctx.child.signalCode === null) ctx.child.kill("SIGKILL");
  }, 5000);
}
