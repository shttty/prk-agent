export function isProjectTrusted(ctx, owner) { ctx.assertLive(owner); return owner.snapshot.projectTrusted; }
