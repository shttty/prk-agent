export function settleGatewayRequest(ctx, pending, error, result) {
  if (!ctx.reverse.delete(pending.id)) return;
  clearTimeout(pending.timer);
  pending.options.signal?.removeEventListener("abort", pending.abort);
  error ? pending.reject(error) : pending.resolve(result);
}
