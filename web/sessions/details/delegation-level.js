export const DELEGATION_LEVELS = ["gated", "restrained", "eager"];

/** The session's child-session level from its snapshot (the one source of light settings); null hides the control. */
export function delegationLevel(snapshot) {
  return DELEGATION_LEVELS.includes(snapshot?.delegation) ? snapshot.delegation : null;
}
