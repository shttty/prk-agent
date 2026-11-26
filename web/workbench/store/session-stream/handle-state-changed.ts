import type { SessionHostEvent } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { mergeEntry } from "../updates/merge-entry.ts";
import { patch } from "../updates/patch.ts";
import { mergeLiveKernel } from "./merge-live-kernel.ts";
import { readStateChange } from "./read-state-change.ts";
import { rowStateOf } from "./row-state-of.ts";

const LISTED_STATES = ["running", "idle", "sleeping", "waking", "unavailable", "closing", "closed"];

export function handleStateChanged(ctx: StoreContext, event: SessionHostEvent) {
  const current = ctx.state.session.snapshot;
  if (!current) return;
  const change = readStateChange(event.details);
  const snapshot = { ...current, ...change, ...(change.kernel ? { kernel: mergeLiveKernel(current.kernel, change.kernel) } : {}) };
  let sessions = ctx.state.sessions;
  const selected = ctx.state.selectedSessionId;
  if (selected) {
    const sessionState = rowStateOf(snapshot.state);
    if (LISTED_STATES.includes(sessionState)) {
      sessions = mergeEntry(sessions, selected, { state: sessionState, compacting: sessionState === "running" && snapshot.operation?.kind === "compact", sessionId: selected });
    }
  }
  patch(ctx, { sessions, session: { ...ctx.state.session, snapshot } });
}
