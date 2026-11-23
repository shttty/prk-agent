import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function readCwd(ctx, owner) { ctx.assertLive(owner); return owner.snapshot.cwd; }
export function getCwd(ctx, owner) { return sessionSnapshot(ctx, owner).cwd; }
