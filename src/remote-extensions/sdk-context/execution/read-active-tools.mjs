import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function readActiveTools(ctx, owner) { return [...sessionSnapshot(ctx, owner).activeTools]; }
