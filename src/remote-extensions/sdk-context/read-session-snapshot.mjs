export function sessionSnapshot(ctx, owner) {
  ctx.assertLive(owner);
  if (!owner.snapshot.sessionId) throw new Error("Remote extension session is not bound yet");
  return owner.snapshot;
}
