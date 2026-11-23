import { WireError } from "../../gateway/wire/create-error.ts";
import type { FileOperation } from "./files-types.ts";
import { request } from "./request.ts";
import { runCommand } from "./run-command.ts";
import { absolutePath } from "../target-paths/absolute-path.ts";

export async function deleteFile(op: FileOperation, path: string): Promise<{ path: string }> {
  absolutePath(path);
  if (path === "/") throw new WireError("INVALID_REQUEST", "The target root cannot be deleted.");
  const { json } = await request(op, "lstat", { path });
  if (json.kind === "directory") await runCommand(op, "rmdir", [path]);
  else await request(op, "rm", { path, recursive: false, force: false });
  return { path };
}
