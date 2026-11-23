import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function readSessionName(ctx, owner) { return sessionSnapshot(ctx, owner).sessionName; }
