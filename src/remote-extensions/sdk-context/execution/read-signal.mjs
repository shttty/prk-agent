export function readSignal(ctx, owner, operation) { ctx.assertLive(owner); return operation.hasSignal ? operation.controller.signal : undefined; }
