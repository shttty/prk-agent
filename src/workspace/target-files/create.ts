import { WireError } from "../../gateway/wire/create-error.ts";
import type { WorkspaceFileFormat } from "../files/files-types.ts";
import type { FileOperation } from "./files-types.ts";
import { request as fileRequest } from "./request.ts";
import { upload } from "./upload.ts";
import { pathExists } from "./path-exists.ts";
import { stat } from "./stat.ts";
import { absolutePath } from "../target-paths/absolute-path.ts";

export async function create(op: FileOperation, request: { path: string; type: "file" | "directory"; content?: string; format?: WorkspaceFileFormat }) {
  const path = absolutePath(request.path);
  if (await pathExists(op, path)) throw new WireError("CONFLICT", "Target path already exists; nothing was created.");
  // The public write API has no exclusive-create option; this preflight is not atomic.
  if (request.type === "directory") await fileRequest(op, "mkdir", { path, recursive: false });
  else await upload(op, path, Buffer.from(request.content ?? "", request.format === "base64" ? "base64" : "utf8"));
  return stat(op, path);
}
