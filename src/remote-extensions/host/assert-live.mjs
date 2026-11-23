export function assertLive(ctx, owner) {
  if (!owner || owner !== ctx.generation || owner.phase === "closed") throw new Error("Stale remote extension generation");
}
