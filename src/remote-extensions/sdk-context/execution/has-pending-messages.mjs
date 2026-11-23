import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function hasPendingMessages(ctx, owner) { return sessionSnapshot(ctx, owner).hasPendingMessages; }
