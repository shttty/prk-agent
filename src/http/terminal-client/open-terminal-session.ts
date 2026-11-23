import type { ClientContext } from "../gateway-connection/client-state.ts";
import type { WebTerminalSink } from "../gateway-connection/client-types.ts";
import type { WebTerminalSession } from "../gateway-connection/client-types.ts";
import { acquireStream } from "../gateway-connection/acquire-stream.ts";
import type { TerminalSessionContext } from "./terminal-session-state.ts";
import { releaseTerminal } from "./connection/release.ts";
import { sendTerminalInput } from "./input/send-terminal-input.ts";
import { resizeTerminal } from "./input/resize-terminal.ts";
import { closeTerminalSession } from "./connection/close-terminal-session.ts";
import { WireError } from "../../gateway/wire/create-error.ts";

export async function openTerminalSession(owner: ClientContext, sessionId: string, name: string, sink: WebTerminalSink, generation?: string): Promise<WebTerminalSession> {
    const client = await acquireStream(owner, sink);
    const ctx: TerminalSessionContext = { owner, client, sessionId, name, sink, released: false, inFlightMax: 0, inFlight: 0, queue: [], stopEvents: undefined, stopLifecycle: undefined };
    ;
    void ctx.client.closed.then(() => releaseTerminal(ctx, "Gateway terminal connection ended."));
    ctx.stopEvents = ctx.client.onTerminalEvent((event, source, terminal) => {
      if (ctx.released || source !== ctx.sessionId || terminal !== ctx.name) return;
      ctx.sink.event(event);
      if (event.type === "closed") releaseTerminal(ctx, "Terminal closed.");
    });
    ctx.stopLifecycle = ctx.client.onCollectionEvent((event) => {
      if (!ctx.released && event.sessionId === ctx.sessionId && ["session_closed", "session_archived"].includes(event.type)) releaseTerminal(ctx, "Gateway session route closed.");
    });
    try {
      if (generation === undefined) await ctx.client.request("terminalOpen", { sessionId: ctx.sessionId, name: ctx.name });
      const snapshot = await ctx.client.request("subscribeTerminal", { sessionId: ctx.sessionId, name: ctx.name });
      if (generation !== undefined && (!snapshot || typeof snapshot !== "object" || !("generation" in snapshot) || snapshot.generation !== generation)) {
        throw new WireError("UNAVAILABLE", "Terminal generation no longer exists.");
      }
      ctx.sink.snapshot(snapshot);
    } catch (error: unknown) {
      ctx.stopEvents!(); ctx.stopLifecycle!();
      ctx.owner.streams.delete(ctx.client);
      ctx.client.disconnect();
      ctx.released = true;
      if (ctx.client.lost) ctx.owner.reachable = false;
      throw error;
    }
    ctx.inFlightMax = Math.max(1, ctx.owner.gateway.pendingMax - 1);


    ;
    return { input: (data) => sendTerminalInput(ctx, data), resize: (rows, cols) => resizeTerminal(ctx, rows, cols), close: () => closeTerminalSession(ctx) };
  }
