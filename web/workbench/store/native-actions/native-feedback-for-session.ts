import type { StoreContext } from "../store-context-types.ts";
import type { NativeFeedback } from "../store-types.ts";

export function nativeFeedbackForSession(ctx: StoreContext, entries: readonly NativeFeedback[]): NativeFeedback[] {
  return entries.filter((entry) => entry.action !== "reference-candidates" && (!entry.sessionId || entry.sessionId === ctx.state.selectedSessionId));
}
