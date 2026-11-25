import { closeFileTransfer } from "../file-transfer/close-file-transfer.ts";
import type { PeerContext } from "./peer-state.ts";

export function releasePeer(ctx: PeerContext): void {
  (0, ctx.unsubscribeHost)?.(); (0, ctx.unsubscribeSessions)?.(); (0, ctx.unsubscribeTerminal)?.();
  closeFileTransfer(ctx);
  const unsubscribeRoutes = ctx.unsubscribeRoutes!;
  unsubscribeRoutes(); ctx.listener.peers.delete(ctx.socket);
}
