import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function readModel(ctx, owner) { return sessionSnapshot(ctx, owner).model; }
