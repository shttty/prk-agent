import { posix } from "node:path";
import { WireError } from "../../gateway/wire/create-error.ts";
import type { FileOperation, FileListing } from "./files-types.ts";
import { request } from "./request.ts";
import { formatMetadata } from "./format-metadata.ts";
import { stat } from "./stat.ts";
import { absolutePath } from "../target-paths/absolute-path.ts";

export async function list(op: FileOperation, path: string): Promise<FileListing> {
  absolutePath(path);
  const opened = await request(op, "opendir", { path });
  const handle = opened.json.handle;
  const entries: FileListing["entries"] = [];
  const limits = op.options.workspace;
  let bytes = Buffer.byteLength(JSON.stringify({ path, entries: [], truncated: false }));
  let truncated = false;
  try {
    if (bytes > limits.directoryBytes) throw new WireError("TOO_LARGE", "Directory budget cannot hold its response envelope.");
    scan: while (true) {
      const { json } = await request(op, "readdir", { handle, max: Math.min(limits.directoryPageEntries, limits.directoryEntries - entries.length + 1) }, { session: opened.session });
      if (!Array.isArray(json.entries) || typeof json.done !== "boolean") throw new WireError("HOST_ERROR", "Malformed target directory page.");
      for (const item of json.entries) {
        if (!item || typeof item !== "object" || typeof item.name !== "string") throw new WireError("HOST_ERROR", "Malformed target directory entry.");
        if (item.error) {
          if (item.error.code === "ENOENT") continue;
          throw new WireError("HOST_ERROR", `Cannot stat target directory entry ${item.name}.`);
        }
        const entryPath = posix.join(path, item.name);
        let entry = formatMetadata(item.info, entryPath);
        if (entry.type === "other") continue;
        if (entry.type === "symlink") entry = await stat(op, entryPath);
        const size = Buffer.byteLength(JSON.stringify(entry)) + (entries.length ? 1 : 0);
        if (entries.length >= limits.directoryEntries || bytes + size > limits.directoryBytes) { truncated = true; break scan; }
        entries.push(entry);
        bytes += size;
      }
      if (json.done) break;
    }
  } finally {
    await request(op, "close", { handle }, { signal: undefined, session: opened.session });
  }
  entries.sort((a, b) => (a.type === "directory" ? 0 : 1) - (b.type === "directory" ? 0 : 1) || a.name.localeCompare(b.name));
  return { path, entries, truncated };
}
