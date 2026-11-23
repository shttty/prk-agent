export function finish(ctx, code) {
  if (ctx.settled) return;
  ctx.settled = true;
  clearTimeout(ctx.timeout);
  clearTimeout(ctx.forceKill);
  ctx.signal.removeEventListener("abort", ctx.kill);
  ctx.resolve({ stdout: ctx.stdout, stderr: ctx.stderr, code: code ?? 0, killed: ctx.killed });
}
