import type { SessionHostSnapshot } from "../../../src/gateway/wire/web-types.ts";

export const DELEGATION_LEVELS = ["gated", "restrained", "eager"];

/** The session's child-session level from its snapshot (the one source of light settings); null hides the control. */
export function delegationLevel(snapshot: Pick<SessionHostSnapshot, "delegation"> | null | undefined): string | null {
  const level = snapshot?.delegation;
  return level !== undefined && DELEGATION_LEVELS.includes(level) ? level : null;
}
