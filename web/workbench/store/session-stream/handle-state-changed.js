import { isRecord } from "../../payloads/is-record.js";
import { mergeEntry } from "../updates/merge-entry.js";
import { patch } from "../updates/patch.js";
import { mergeLiveKernel } from "./merge-live-kernel.js";
export function handleStateChanged(ctx, event) {
    const details = isRecord(event.details) ? event.details : {};
    if (!ctx.state.session.snapshot) return;
    const snapshot = { ...ctx.state.session.snapshot };
    if (typeof details.state === "string") snapshot.state = details.state;
    if (Object.hasOwn(details, "operation")) snapshot.operation = isRecord(details.operation) ? details.operation : undefined;
    if (isRecord(details.kernel)) snapshot.kernel = mergeLiveKernel(ctx.state.session.snapshot.kernel, details.kernel);
    if (Array.isArray(details.kernelCells)) snapshot.kernelCells = details.kernelCells;
    if (Array.isArray(details.terminals)) snapshot.terminals = details.terminals;
    let sessions = ctx.state.sessions;
    if (ctx.state.selectedSessionId) {
      const sessionState = snapshot.state === "running" || snapshot.state === "cancel_requested" ? "running" : snapshot.state;
      if (["running", "idle", "sleeping", "waking", "unavailable", "closing", "closed"].includes(sessionState)) {
        sessions = mergeEntry(ctx, sessions, ctx.state.selectedSessionId, { state: sessionState, compacting: sessionState === "running" && snapshot.operation?.kind === "compact", sessionId: ctx.state.selectedSessionId });
      }
    }
    patch(ctx, { sessions, session: { ...ctx.state.session, snapshot } });
  }

