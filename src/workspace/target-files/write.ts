import { WireError } from "../../gateway/wire/create-error.ts";
import type { FileOperation } from "./files-types.ts";
import { writeContent } from "./write-content.ts";
import { stat } from "./stat.ts";
import { absolutePath } from "../target-paths/absolute-path.ts";

export async function write(op: FileOperation, request: { path: string; content: string; format: "text"; expectedLastModified?: string }) {
  const path = absolutePath(request.path);
  if (request.expectedLastModified !== undefined) {
    const current = await stat(op, path);
    if (current.last_modified !== request.expectedLastModified) throw new WireError("CONFLICT", "File changed since it was read; no save was performed.", { last_modified: current.last_modified });
  }
  // Best effort, not CAS: external writers can change the file between stat and write.
  await writeContent(op, path, Buffer.from(request.content));
  return stat(op, path);
}
