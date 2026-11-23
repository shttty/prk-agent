import type { Reply } from "@earendil-works/pi-env";
import { WireError } from "../../gateway/wire/create-error.ts";
import type { FileOperation } from "./files-types.ts";
import { readChunk } from "./read-chunk.ts";

export async function readBytes(op: FileOperation, opened: Reply, maxBytes: number): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (length <= maxBytes) {
    const size = Math.min(op.options.workspace.fileChunkBytes, maxBytes + 1 - length);
    const chunk = await readChunk(op, opened, length, size);
    if (!chunk.byteLength) break;
    length += chunk.byteLength;
    if (length > maxBytes) throw new WireError("TOO_LARGE", `File exceeds the ${maxBytes} byte read limit.`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}
