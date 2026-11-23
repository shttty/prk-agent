import type { PeerContext } from "../connection/peer-state.ts";

export function closeDownload(ctx: PeerContext): void {
  const download = ctx.download;
  delete ctx.download;
  void download?.return(undefined).catch((error: unknown) => {
    console.warn(`[${new Date().toISOString()}] Workspace download cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  });
}
