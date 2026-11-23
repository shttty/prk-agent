import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function readThinkingLevel(ctx, owner) { return sessionSnapshot(ctx, owner).thinkingLevel; }
