import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function isIdle(ctx, owner) { return sessionSnapshot(ctx, owner).isIdle; }
