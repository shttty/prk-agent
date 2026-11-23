import type { ClientContext } from "../client-state.ts";
import { WireError } from "../../wire/create-error.ts";

export function disconnectClient(ctx: ClientContext): void {
  if (ctx.lost) return;
  ctx.lost = true;
  for (const entry of ctx.pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(new WireError("CLIENT_ERROR","Gateway connection lost; request outcome unknown. Inspect state after explicit reconnect; do not replay."));
  }
  ctx.pending.clear(); ctx.listeners.clear(); ctx.collectionListeners.clear(); ctx.terminalListeners.clear(); ctx.socket.destroy(); ctx.closed.resolve();
}
