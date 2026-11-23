import { WireError } from "../../gateway/wire/create-error.ts";

export function decodeListing(payload: Uint8Array, count: unknown): { path: string; kind: "file" | "directory" | "symlink" }[] {
  const entries: { path: string; kind: "file" | "directory" | "symlink" }[] = [];
  const bytes = Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  let offset = 0;
  while (offset < bytes.length) {
    const end = bytes.indexOf(0, offset + 1);
    const tag = bytes[offset];
    if (end < 0 || ![102, 100, 108].includes(tag!)) throw new WireError("HOST_ERROR", "Malformed target file listing.");
    const path = bytes.toString("utf8", offset + 1, end);
    if (!path || path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === "..")) throw new WireError("HOST_ERROR", "Invalid target listing path.");
    entries.push({ path, kind: tag === 102 ? "file" : tag === 100 ? "directory" : "symlink" });
    offset = end + 1;
  }
  if (entries.length !== count) throw new WireError("HOST_ERROR", "Target listing count does not match its payload.");
  return entries;
}
