import { posix } from "node:path";
import { WireError } from "../../gateway/wire/create-error.ts";
import type { FileOperation } from "./files-types.ts";
import { request } from "./request.ts";
import { pathExists } from "./path-exists.ts";
import { runCommand } from "./run-command.ts";
import { stat } from "./stat.ts";
import { absolutePath } from "../target-paths/absolute-path.ts";

export async function copy(op: FileOperation, path: string, toDir: string) {
  absolutePath(path);
  absolutePath(toDir);
  if (path === "/") throw new WireError("INVALID_REQUEST", "The target root cannot be copied.");
  const source = (await request(op, "lstat", { path })).json;
  const directory = await stat(op, toDir);
  if (directory.type !== "directory") throw new WireError("INVALID_REQUEST", "Copy destination is not a directory.", { reason: "not-directory" });
  const canonicalSource = source.kind === "directory" ? (await request(op, "realpath", { path })).json.path : undefined;
  const canonicalDestination = (await request(op, "realpath", { path: toDir })).json.path;
  if (typeof canonicalDestination !== "string" || canonicalSource !== undefined && typeof canonicalSource !== "string") throw new WireError("HOST_ERROR", "Malformed canonical target path.");
  if (canonicalSource && (canonicalDestination === canonicalSource || canonicalDestination.startsWith(`${canonicalSource}/`))) {
    throw new WireError("INVALID_REQUEST", "A directory cannot be copied inside itself.");
  }
  const name = posix.basename(path);
  const extension = source.kind === "directory" ? "" : posix.extname(name);
  const stem = name.slice(0, name.length - extension.length);
  let destination = posix.join(toDir, name);
  let suffix = 0;
  while (await pathExists(op, destination)) destination = posix.join(toDir, `${stem}-Copy${++suffix}${extension}`);
  await runCommand(op, "cp", [path, destination]);
  return stat(op, destination);
}
