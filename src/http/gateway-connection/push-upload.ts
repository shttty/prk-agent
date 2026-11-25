import type { ClientContext } from "./client-state.ts";
import type { UploadMetadata } from "../../workspace/target-files/files-types.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import { withFileTransfer } from "./with-file-transfer.ts";

export async function uploadFile(ctx: ClientContext, params: Record<string, unknown>, signal: AbortSignal, source: AsyncIterable<Buffer>): Promise<void> {
  await withFileTransfer(ctx, signal, async (client) => {
    const { value: { chunkBytes } } = await client.request("filesUpload", params) as { value: UploadMetadata };
    if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1) throw new WireError("HOST_ERROR", "Invalid Gateway upload chunk size.");
    for await (const bytes of source) {
      for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
        signal.throwIfAborted();
        await client.request("filesUploadChunk", { data: bytes.subarray(offset, offset + chunkBytes).toString("base64") });
      }
    }
    signal.throwIfAborted();
    try { await client.request("filesUploadFinish"); }
    catch (error) {
      if (error instanceof WireError && error.code === "CLIENT_ERROR") throw new WireError("UNKNOWN", error.message);
      throw error;
    }
  });
}
