import { WireError } from "../../gateway/wire/create-error.ts";
import type { FileOperation } from "./files-types.ts";
import { request } from "./request.ts";
import { pathExists } from "./path-exists.ts";
import { stat } from "./stat.ts";
import { absolutePath } from "../target-paths/absolute-path.ts";

export async function rename(op: FileOperation, path: string, newPath: string) {
  absolutePath(path);
  absolutePath(newPath);
  if (path === "/" || newPath === "/") throw new WireError("INVALID_REQUEST", "The target root cannot be renamed or replaced.");
  if (path === newPath) return stat(op, path);
  if (await pathExists(op, newPath)) throw new WireError("CONFLICT", "Destination already exists; nothing was renamed.");
  await request(op, "rename", { path, to: newPath });
  return stat(op, newPath);
}
