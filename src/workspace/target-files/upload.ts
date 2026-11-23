import type { FileOperation } from "./files-types.ts";
import { request } from "./request.ts";

export async function upload(op: FileOperation, path: string, bytes: Uint8Array): Promise<void> {
  const size = op.options.workspace.fileChunkBytes;
  const opened = await request(op, "write", { path, append: false, parents: false, keep: true }, { payload: bytes.subarray(0, size) });
  const handle = opened.json.handle;
  try {
    for (let offset = size; offset < bytes.byteLength; offset += size) {
      await request(op, "writeChunk", { handle }, { payload: bytes.subarray(offset, offset + size), session: opened.session });
    }
  } finally {
    await request(op, "close", { handle }, { signal: undefined, session: opened.session });
  }
}
