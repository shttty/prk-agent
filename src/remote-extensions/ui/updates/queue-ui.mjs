export function queueUi(ctx, owner, operation, method, args) {
  ctx.assertLive(owner);
  const promise = ctx.reverseRequest(owner, operation.id, "ui", { method, args });
  if (!operation.finished) {
    operation.ui.add(promise);
    // Synchronous UI methods cannot throw a later remote error; the callback barrier reports it.
    void promise.catch(() => {});
  } else {
    void promise.catch((error) => console.error(`[remote-extension host] idle ui.${method}:`, error));
  }
}
