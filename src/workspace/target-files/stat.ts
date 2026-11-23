import type { FileOperation } from "./files-types.ts";
import { request } from "./request.ts";
import { formatMetadata } from "./format-metadata.ts";

export async function stat(op: FileOperation, path: string) {
  let metadata = formatMetadata((await request(op, "lstat", { path })).json, path);
  if (metadata.type === "symlink") {
    const resolved = await request(op, "realpath", { path });
    metadata = formatMetadata((await request(op, "lstat", { path: resolved.json.path })).json, path);
  }
  return metadata;
}
