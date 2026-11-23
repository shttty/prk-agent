import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function readSessionId(ctx, owner) { return sessionSnapshot(ctx, owner).sessionId; }
