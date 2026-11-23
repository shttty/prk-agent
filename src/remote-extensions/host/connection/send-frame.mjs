export function send(ctx, frame) {
  if (!ctx.connected || ctx.socket.destroyed) throw new Error("Remote extension transport is closed");
  ctx.socket.write(`${JSON.stringify(frame)}\n`);
}
