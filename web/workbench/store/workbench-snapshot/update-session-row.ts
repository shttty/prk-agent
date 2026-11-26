import type { StoreContext } from "../store-context-types.ts";
import type { SessionRow } from "../store-types.ts";
import { patch } from "../updates/patch.ts";

/** Change fields of one listed row; a session the list does not hold yet starts as an empty row. */
export function updateSessionRow(ctx: StoreContext, name: string, changes: Partial<SessionRow>) {
  if (!name) return;
  const previous: SessionRow = ctx.state.sessions.get(name) ?? { sessionId: name, state: "idle", target: "", label: "", cwd: "" };
  const sessions = new Map(ctx.state.sessions).set(name, { ...previous, ...changes, sessionId: name });
  patch(ctx, { sessions });
}
