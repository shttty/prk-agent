

export async function stopProcess(ctx, handle, signal = "SIGTERM") {
  if (!handle || handle.child.exitCode !== null || handle.child.signalCode !== null) return ctx.safeProcessRecord(handle);
  handle.child.kill(signal);
  const stopped = await Promise.race([handle.done.then(() => true), ctx.sleep(10_000).then(() => false)]);
  if (!stopped && handle.child.exitCode === null && handle.child.signalCode === null) {
    handle.child.kill("SIGKILL");
    await handle.done;
  }
  return ctx.safeProcessRecord(handle);
}
