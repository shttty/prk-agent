

export async function startGateway(ctx, socket, env, args) {
  const handle = ctx.launchProcess(["gateway", "--socket", socket, ...args], env, ctx.runtimeRoot);
  try {
    await ctx.waitFor(async () => {
      if (handle.child.exitCode !== null || handle.child.signalCode !== null) {
        throw new Error(`Gateway exited before readiness (code=${handle.child.exitCode}, signal=${handle.child.signalCode}).`);
      }
      return ctx.exists(socket);
    }, "Gateway Unix socket");
    const client = await ctx.bounded(ctx.connectGateway(socket), "Gateway client attach", 30_000);
    client.disconnect();
    return handle;
  } catch (error) {
    try { await ctx.stopProcess(handle, "SIGKILL"); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], "Gateway startup and cleanup failed"); }
    const diagnostic = handle.stderr.trim().slice(-4_000);
    throw new Error(`${error instanceof Error ? error.message : String(error)} ${diagnostic}`.trim());
  }
}
