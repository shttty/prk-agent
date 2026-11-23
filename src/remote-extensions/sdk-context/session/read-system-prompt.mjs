import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function readSystemPrompt(ctx, owner) { return sessionSnapshot(ctx, owner).systemPrompt; }
