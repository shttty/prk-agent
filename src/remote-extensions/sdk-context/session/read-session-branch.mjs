import { sessionSnapshot } from "../read-session-snapshot.mjs";

export function readSessionBranch(ctx, owner) {
  return sessionSnapshot(ctx, owner).branch;
}
