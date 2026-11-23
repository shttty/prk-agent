

export async function startWeb(ctx, socket, env, port = 0) {
  const handle = ctx.launchProcess(["web", "--socket", socket, "--host", "127.0.0.1", "--port", String(port)], env, ctx.runtimeRoot);
  const { child } = handle;
  try {
  await ctx.waitFor(async () => {
    if (child.exitCode !== null || child.signalCode !== null) {
      const diagnostic = handle.stderr.trim().slice(-4_000);
      const endpointPresent = await ctx.exists(socket).catch(() => false);
      throw new Error(`Web process exited before readiness (code=${child.exitCode}, signal=${child.signalCode}; endpointPresent=${endpointPresent}). ${diagnostic}`);
    }
    const match = /Web client ready at (http:\/\/127\.0\.0\.1:\d+)/.exec(handle.stderr);
    if (!match) return false;
    handle.url = match[1];
    return true;
  }, "web HTTP listener");
  return handle;
  } catch (error) {
    try { await ctx.stopProcess(handle); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], "Web startup and cleanup failed"); }
    throw error;
  }
}
