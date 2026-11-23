import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function readSessionManager(ctx, owner) { sessionSnapshot(ctx, owner); return owner.sessionManager; }
