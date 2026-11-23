import type { SessionReadIssue } from "./history-types.ts";

export function formatReadIssue(identity: Omit<SessionReadIssue, "reason">, cause: unknown): SessionReadIssue {
  const sessionId = typeof identity.sessionId === "string" && identity.sessionId.trim().length > 0 ? identity.sessionId : undefined;
  return Object.freeze({
    location: sessionId === undefined ? "unknown" : identity.location,
    ...(sessionId === undefined ? {} : { sessionId }),
    sessionFile: identity.sessionFile,
    ...(identity.label === undefined ? {} : { label: identity.label }),
    ...(identity.target === undefined ? {} : { target: identity.target }),
    ...(identity.archived === undefined ? {} : { archived: identity.archived }),
    reason: cause instanceof Error ? cause.message : String(cause),
  });
}
