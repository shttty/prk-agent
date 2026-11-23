import type { Reply } from "@earendil-works/pi-env";
import type { FileOperation } from "./files-types.ts";
import { request } from "./request.ts";

export async function readChunk(op: FileOperation, opened: Reply, offset: number, length: number): Promise<Uint8Array> {
  return (await request(op, "pread", { handle: opened.json.handle, offset, length }, { session: opened.session })).payload;
}
