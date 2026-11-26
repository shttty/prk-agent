import type { StoreContext } from "../store-context-types.ts";
import type { UnreadableSession } from "../../payloads/payload-types.ts";

/** Whether the selected native session is reported as unreadable; file-only diagnostics match nothing. */
export function unreadableSelection(ctx: StoreContext, issues: readonly UnreadableSession[]): boolean {
  const name = ctx.state.selectedSessionId;
  if (!name) return false;
  return issues.some((issue) => issue.sessionId === name);
}
