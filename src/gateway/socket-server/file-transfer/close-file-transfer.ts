import type { PeerContext } from "../connection/peer-state.ts";

export function closeFileTransfer(ctx: PeerContext): void {
  const transfer = ctx.fileTransfer;
  delete ctx.fileTransfer;
  void transfer?.stream.return(undefined).catch((error: unknown) => {
    console.warn(`[${new Date().toISOString()}] Workspace file transfer cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  });
}
