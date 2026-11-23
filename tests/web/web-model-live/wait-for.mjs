

export async function waitFor(ctx, predicate, description, milliseconds = ctx.STARTUP_TIMEOUT_MS) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    ctx.fixtureSignal?.throwIfAborted();
    if (await predicate()) return;
    await ctx.sleep(100);
  }
  throw new Error(`Timed out: ${description}`);
}
