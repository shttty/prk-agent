import { posix } from "node:path";
import { WireError } from "../../gateway/wire/create-error.ts";
import type { WorkspaceFileMetadata } from "../files/files-types.ts";

export function formatMetadata(info: unknown, path: string): WorkspaceFileMetadata {
  if (!info || typeof info !== "object" || !("kind" in info) || !("size" in info)
    || !("mtimeSec" in info) || !("mtimeNsec" in info) || typeof info.kind !== "string"
    || typeof info.size !== "number" || typeof info.mtimeSec !== "number" || typeof info.mtimeNsec !== "number") {
    throw new WireError("HOST_ERROR", "Malformed target file metadata.");
  }
  return {
    name: posix.basename(path), path,
    type: info.kind === "file" && path.endsWith(".ipynb") ? "notebook" : info.kind,
    size: info.size, mimetype: null,
    last_modified: `mtime:${info.mtimeSec * 1000 + info.mtimeNsec / 1e6}`, writable: null,
  };
}
