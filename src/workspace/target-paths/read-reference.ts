import { WireError } from "../../gateway/wire/create-error.ts";
import type { FileOperation } from "../target-files/files-types.ts";
import { read } from "../target-files/read.ts";

export async function readReference(op: FileOperation, path: string): Promise<{ path: string; type: string; content: string }> {
  const file = await read(op, path, "text", op.options.references.maxBytes);
  if (file.content.includes("\0")) throw new WireError("INVALID_REQUEST", "Target reference is not text.");
  return { path: file.path, type: "text/plain", content: file.content };
}
