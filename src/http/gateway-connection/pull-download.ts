import type { ClientContext } from "./client-state.ts";
import type { WebDownloadSink } from "./client-types.ts";
import type { DownloadChunk, DownloadMetadata } from "../../workspace/target-files/files-types.ts";
import { withFileTransfer } from "./with-file-transfer.ts";
import { WireError } from "../../gateway/wire/create-error.ts";

export async function downloadFile(ctx: ClientContext, params: Record<string, unknown>, signal: AbortSignal, sink: WebDownloadSink): Promise<void> {
  await withFileTransfer(ctx, signal, async (client) => {
    const { value: metadata } = await client.request("filesDownload", params) as { value: DownloadMetadata };
    sink.open(metadata);
    let remaining = metadata.size;
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await client.request("filesDownloadNext") as { value: DownloadChunk; done: boolean };
      const chunk = Buffer.from(value.data, "base64");
      remaining -= chunk.length;
      if (remaining < 0 || done !== (remaining === 0) || (!done && chunk.length === 0)) {
        throw new WireError("HOST_ERROR", "Gateway download did not match the declared length.");
      }
      if (chunk.length !== 0) await sink.write(chunk);
      if (done) return;
    }
  });
}
