import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import { WireError } from "../../wire/create-error.ts";
import type { FileDownload, FileUpload } from "../../../workspace/target-files/files-types.ts";
import { closeFileTransfer } from "./close-file-transfer.ts";

export async function dispatchFileTransfer(ctx: PeerContext, respond: Respond, { id, method, params }: Request): Promise<void> {
  const direction = method.startsWith("filesDownload") ? "filesDownload" : "filesUpload";
  const opening = method === direction;
  if (ctx.advancingFileTransfer || (opening && ctx.fileTransfer)) throw new WireError("BUSY", "A file transfer is already open on this connection.");
  if (!opening && ctx.fileTransfer?.method !== direction) throw new WireError("INVALID_REQUEST", "This connection has no matching file transfer.");
  ctx.advancingFileTransfer = true;
  try {
    if (opening) {
      const stream = await ctx.listener.host.workspace(direction, params.sessionId as string, params);
      if (ctx.socket.destroyed) return;
      ctx.fileTransfer = direction === "filesDownload" ? { method: direction, stream: stream as FileDownload } : { method: direction, stream: stream as FileUpload };
    }
    const transfer = ctx.fileTransfer!;
    const result = transfer.method === "filesDownload" ? await transfer.stream.next()
      : await transfer.stream.next(method === "filesUploadChunk" ? Buffer.from(params.data as string, "base64") : undefined);
    if (result.done) delete ctx.fileTransfer;
    if (!ctx.socket.destroyed && !respond(id, { done: Boolean(result.done), value: result.value })) closeFileTransfer(ctx);
  } catch (error) {
    closeFileTransfer(ctx);
    throw error;
  } finally {
    ctx.advancingFileTransfer = false;
  }
}
