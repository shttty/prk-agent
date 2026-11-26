import type { SessionHostSnapshot } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import type { Connection, SessionRow } from "../store-types.ts";

/** The parts of the page state a session's request outcome depends on; a change in any means the page moved on. */
export type SessionPhase = [SessionRow | undefined, SessionHostSnapshot | null, string | null, Connection | null];

export function sessionPhase(ctx: StoreContext, name: string): SessionPhase {
  const selected = ctx.state.selectedSessionId === name;
  return [ctx.state.sessions.get(name), selected ? ctx.state.session.snapshot : null, selected ? ctx.state.session.streamId : null, selected ? ctx.state.session.connection : null];
}
