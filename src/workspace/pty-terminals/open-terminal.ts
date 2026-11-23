import { randomUUID } from "node:crypto";
import { WireError } from "../../gateway/wire/create-error.ts";
import { TerminalReplay } from "../terminal-replay/create-replay.ts";
import type { ModelTerminalStartup, TerminalSnapshot } from "../terminals/terminals-types.ts";
import type { PtyContext, PtyEntry } from "./terminal-state.ts";
import { startTerminal } from "./start-terminal.ts";
import { snapshotTerminal } from "./snapshot-terminal.ts";

export async function openOwnedTerminal(ctx: PtyContext, sessionId: string, context: { cwd: string }, name: string, startup?: ModelTerminalStartup): Promise<TerminalSnapshot> {
  if (ctx.stopped || ctx.closingSessions.has(sessionId)) throw new WireError("BUSY", "Session terminals are closing.");
  let terminals = ctx.sessions.get(sessionId);
  let entry = terminals?.get(name);
  if (entry?.closing) throw new WireError("BUSY", "Terminal is closing.");
  if (!entry) {
    if ((terminals?.size ?? 0) >= ctx.options.workspace.terminalsPerWorkerMax) throw new WireError("BUSY", "Session terminal limit reached.");
    const target = ctx.options.ownerTarget(sessionId);
    if (!target) throw new WireError("NOT_FOUND", "Terminal owner does not exist.");
    if (!context.cwd.startsWith("/") || context.cwd.includes("\0")) throw new WireError("INVALID_REQUEST", "Terminal cwd must be an absolute target path.");
    const ready = Promise.withResolvers<void>();
    let timer: NodeJS.Timeout | undefined;
    const handshake = Promise.withResolvers<void>();
    void handshake.promise.catch(() => {});
    entry = {
      sessionId, name, target, startup, generation: randomUUID(), rows: 24, cols: 80,
      replay: new TerminalReplay(ctx.options.workspace.terminalReplayBytes), listeners: new Set(),
      closed: false, integration: "unavailable", integrationReady: ready.promise,
      finishIntegration() { clearTimeout(timer); ready.resolve(); },
      markerTail: "", decoder: new TextDecoder(),
      startupText: "", handshake: handshake.promise, resolveHandshake: handshake.resolve, rejectHandshake: handshake.reject,
    };
    timer = setTimeout(entry.finishIntegration, ctx.options.workspace.terminalStartTimeoutMs);
    timer.unref();
    if (!terminals) { terminals = new Map<string, PtyEntry>(); ctx.sessions.set(sessionId, terminals); }
    terminals.set(name, entry);
    entry.opening = startTerminal(ctx, entry, context.cwd);
  }
  await entry.opening;
  if (entry.closed) throw new WireError("UNAVAILABLE", "Terminal ended during creation.");
  return snapshotTerminal(entry);
}
