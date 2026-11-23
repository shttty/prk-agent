import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function readSessionFile(ctx, owner) { return sessionSnapshot(ctx, owner).sessionFile; }
