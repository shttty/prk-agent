import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import { WireError } from "../../wire/create-error.ts";
import type { FileDownload } from "../../../workspace/target-files/files-types.ts";
import { closeDownload } from "./close-download.ts";

export async function dispatchDownload(ctx: PeerContext, respond: Respond, { id, method, params }: Request): Promise<void> {
  if (ctx.pullingDownload || (method === "filesDownload" && ctx.download)) throw new WireError("BUSY", "A download is already open on this connection.");
  ctx.pullingDownload = true;
  try {
    if (method === "filesDownload") {
      const download = await ctx.listener.host.workspace(method, params.sessionId as string, params) as FileDownload;
      if (ctx.socket.destroyed) return;
      ctx.download = download;
    }
    if (!ctx.download) throw new WireError("INVALID_REQUEST", "This connection has no open download.");
    const { done, value } = await ctx.download.next();
    if (done) delete ctx.download;
    if (!ctx.socket.destroyed && !respond(id, { done: Boolean(done), value })) closeDownload(ctx);
  } catch (error) {
    closeDownload(ctx);
    throw error;
  } finally {
    ctx.pullingDownload = false;
  }
}
