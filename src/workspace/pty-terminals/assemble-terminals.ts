import type { PtyContext, PtyTerminalOptions } from "./terminal-state.ts";
import type { Listener, ModelTerminalStartup, WorkspaceTerminals } from "../terminals/terminals-types.ts";
import { openOwnedTerminal } from "./open-terminal.ts";
import { listTerminals } from "./list-terminals.ts";
import { sendInput } from "./send-input.ts";
import { resizeTerminal } from "./resize-terminal.ts";
import { subscribeTerminal } from "./subscribe-terminal.ts";
import { readIntegration } from "./read-integration.ts";
import { closeTerminal } from "./close-terminal.ts";
import { closeSession } from "./close-session.ts";
import { shutdown } from "./shutdown.ts";

export function createPtyTerminals(options: PtyTerminalOptions): WorkspaceTerminals {
  const ctx: PtyContext = { options, sessions: new Map(), closingSessions: new Map(), stopped: false };
  return {
    has(sessionId: string, name: string) { return ctx.sessions.get(sessionId)?.has(name) ?? false; },
    open(sessionId: string, context: { cwd: string }, name: string, startup?: ModelTerminalStartup) { return openOwnedTerminal(ctx, sessionId, context, name, startup); },
    list(sessionId: string) { return listTerminals(ctx, sessionId); },
    input(sessionId: string, name: string, data: string) { return sendInput(ctx, sessionId, name, data); },
    resize(sessionId: string, name: string, rows: number, cols: number) { return resizeTerminal(ctx, sessionId, name, rows, cols); },
    modelShellPid(sessionId, name) {
      const entry = ctx.sessions.get(sessionId)?.get(name);
      return !entry?.closed && entry?.startup?.owner === "model" ? entry.shellPid : undefined;
    },
    integration(sessionId: string, name: string) { return readIntegration(ctx, sessionId, name); },
    subscribe(sessionId: string, name: string, listener: Listener) { return subscribeTerminal(ctx, sessionId, name, listener); },
    close(sessionId: string, name: string) { return closeTerminal(ctx, sessionId, name); },
    closeSession(sessionId: string) { return closeSession(ctx, sessionId); },
    shutdown() { return shutdown(ctx); },
  };
}
