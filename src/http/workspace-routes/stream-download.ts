import { once } from "node:events";
import type { ServerResponse } from "node:http";
import { create as contentDisposition } from "content-disposition";
import mime from "mime";
import type { DownloadMetadata } from "../../workspace/target-files/files-types.ts";
import type { WebGatewayClient } from "../gateway-connection/client-types.ts";
import { HttpError } from "../request/create-error.ts";
import { gatewayFailure } from "../request/translate-gateway-failure.ts";
import { sniffImage } from "./sniff-image.ts";

const INLINE_IMAGE_LIMIT = 32 * 1024 ** 2;
const IMAGE_HEADER_BYTES = 12;

export async function streamDownload(gateway: WebGatewayClient, response: ServerResponse, params: Record<string, unknown>, imageType?: string): Promise<void> {
  const abort = new AbortController();
  const stop = () => abort.abort();
  response.once("close", stop);
  if (response.destroyed) stop();
  let metadata: DownloadMetadata;
  let prefix: Buffer = Buffer.alloc(0);
  const writeHeaders = () => {
    response.strictContentLength = true;
    response.writeHead(200, {
      "Content-Disposition": contentDisposition(metadata.name, { type: imageType ? "inline" : "attachment" }),
      "Content-Type": imageType ?? mime.getType(metadata.name) ?? "application/octet-stream",
      "Content-Length": metadata.size,
    });
  };
  const write = async (bytes: Buffer) => {
    if (!response.write(bytes)) await once(response, "drain", { signal: abort.signal });
  };
  try {
    await gateway.downloadFile(params, abort.signal, {
      open(value) {
        metadata = value;
        if (imageType && value.size > INLINE_IMAGE_LIMIT) throw new HttpError(413, "Inline image exceeds 32 MiB.");
      },
      async write(bytes) {
        abort.signal.throwIfAborted();
        if (!response.headersSent) {
          if (imageType) {
            const need = Math.min(IMAGE_HEADER_BYTES, metadata.size) - prefix.length;
            const head = bytes.subarray(0, need);
            prefix = prefix.length ? Buffer.concat([prefix, head]) : head;
            if (head.length < need) return;
            if (sniffImage(prefix) !== imageType) throw new HttpError(415, "Image content does not match its extension.");
            writeHeaders();
            await write(prefix);
            bytes = bytes.subarray(head.length);
          } else writeHeaders();
        }
        if (bytes.length) await write(bytes);
      },
    });
    if (response.destroyed) return;
    if (!response.headersSent) {
      if (imageType) throw new HttpError(415, "Empty image file.");
      writeHeaders();
    }
    response.end();
  } catch (error) {
    if (abort.signal.aborted) return;
    if (response.headersSent) {
      console.warn(`[${new Date().toISOString()}] Workspace download interrupted: ${error instanceof Error ? error.message : String(error)}`);
      response.destroy();
      return;
    }
    throw gatewayFailure(error, "Target file download could not be started.");
  } finally {
    response.off("close", stop);
  }
}
