import type { TerminalSessionContext } from "../terminal-session-state.ts";
import { pump } from "./pump.ts";
import { Buffer } from "node:buffer";
import { WireError } from "../../../gateway/wire/create-error.ts";

export function sendTerminalInput(ctx: TerminalSessionContext, data: string): void {
        if (ctx.released) return;
        const last = ctx.queue.at(-1);
        const queuedBytes = ctx.queue.reduce((total, item) => total + (item.method === "terminalInput" ? Buffer.byteLength(item.data) : 0), 0);
        if (Buffer.byteLength(data) + queuedBytes > ctx.owner.limits.inputBytes || (last?.method !== "terminalInput" && ctx.queue.length >= ctx.owner.gateway.pendingMax)) {
          ctx.sink.failure(new WireError("BUSY", "Terminal input queue is full; input was not sent."));
          return;
        }
        if (last?.method === "terminalInput") last.data += data; else ctx.queue.push({ method: "terminalInput", data });
        pump(ctx);
      }
