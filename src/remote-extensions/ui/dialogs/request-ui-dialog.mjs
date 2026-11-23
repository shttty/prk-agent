export function dialog(ctx, owner, operation, method, defaultValue, ...args) {
  ctx.assertLive(owner);
  const opts = args[2];
  if (opts?.signal?.aborted) return Promise.resolve(defaultValue);
  const wireArgs = args.slice(0, 2);
  if (opts !== undefined) {
    const { signal: _signal, ...rest } = opts;
    wireArgs.push(rest);
  }
  return ctx.reverseRequest(owner, operation.id, "ui", { method, args: wireArgs }, {
    signal: opts?.signal, timeout: opts?.timeout, dialog: true, defaultValue,
  });
}
