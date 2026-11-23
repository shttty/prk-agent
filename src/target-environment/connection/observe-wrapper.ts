import type { Socket } from "node:net";
import type { EnvironmentsContext, EnvironmentRecord } from "./connection-state.ts";
import { retireEnvironment } from "./retire-environment.ts";

export function observeWrapper(ctx: EnvironmentsContext, record: EnvironmentRecord, socket: Socket): void {
  if (record.sockets.size || record.abort.signal.aborted) { socket.destroy(); return; }
  record.sockets.add(socket);
  let pending = "";
  const fail = (error: Error): void => { void retireEnvironment(ctx, record, error); };
  socket.setEncoding("utf8");
  socket.on("data", (text: string) => {
    pending += text;
    if (Buffer.byteLength(pending) > 65536) { fail(new Error("Wrapper control exceeds 64 KiB")); return; }
    let newline: number;
    while ((newline = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      try {
        const event: Record<string, unknown> = JSON.parse(line);
        ctx.options.onEvent?.(record.id, event);
        if (event.kind === "failure") fail(Object.assign(new Error(String(event.message)), { reason: event.reason }));
        if (event.kind === "exit") fail(new Error(`Target exited code=${event.code} signal=${event.signal}`));
      } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
    }
  });
  socket.on("error", fail);
  socket.on("close", () => {
    record.exited.resolve();
    fail(new Error("Target transport closed; unconfirmed operations are unknown"));
  });
}
