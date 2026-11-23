import { assertLive } from "../assert-live.mjs";
import { freeze } from "../../sdk-facade/freeze-value.mjs";

export function snapshot(ctx, owner, next) {
  assertLive(ctx, owner);
  const initial = owner.phase === "loading" && next?.revision === 0 && next.sessionId === undefined;
  if (!next || !Number.isSafeInteger(next.revision) || next.revision < 0 || typeof next.cwd !== "string" ||
      typeof next.projectTrusted !== "boolean" || (!initial && (
      typeof next.sessionId !== "string" || !next.sessionId ||
      !Array.isArray(next.activeTools) || !next.activeTools.every((name) => typeof name === "string") ||
      !Array.isArray(next.branch) || !next.branch.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry) && typeof entry.type === "string") ||
      typeof next.isIdle !== "boolean" || typeof next.hasPendingMessages !== "boolean" ||
      typeof next.systemPrompt !== "string" || (next.sessionName !== undefined && typeof next.sessionName !== "string") ||
      (next.sessionFile !== undefined && typeof next.sessionFile !== "string") ||
      (next.thinkingLevel !== undefined && typeof next.thinkingLevel !== "string") ||
      (next.model !== undefined && (!next.model || typeof next.model !== "object" || Array.isArray(next.model)))))) {
    throw new TypeError("Invalid remote extension context snapshot");
  }
  if (!owner.snapshot || next.revision > owner.snapshot.revision || (!owner.snapshot.sessionId && next.sessionId)) owner.snapshot = freeze(next);
  return { revision: owner.snapshot.revision };
}
