import { randomUUID } from "node:crypto";
import { posix } from "node:path";
import { WireError } from "../../gateway/wire/create-error.ts";
import type { FileOperation, FilesState, FileUpload, TargetFileContext } from "./files-types.ts";
import { acquireOperation } from "./acquire-operation.ts";
import { prepareOperation } from "./prepare-operation.ts";
import { withDeadline } from "./with-deadline.ts";
import { request } from "./request.ts";
import { formatMetadata } from "./format-metadata.ts";
import { pathExists } from "./path-exists.ts";

export async function* streamUpload(state: FilesState, context: TargetFileContext, path: string, overwrite: boolean, wireChunkBytes: number): FileUpload {
  if (path === "/") throw new WireError("INVALID_REQUEST", "The target root cannot be replaced.");
  const { options } = state;
  const chunkBytes = Math.min(options.workspace.fileChunkBytes, wireChunkBytes);
  if (chunkBytes < 1) throw new WireError("TOO_LARGE", "Gateway frame budget is too small for a file upload.");
  const scope = await acquireOperation(state, context);
  const run = <T>(work: () => Promise<T>) => withDeadline(scope.lease, options.targetConnection.requestTimeoutMs, work);
  try {
    const op = await run(() => prepareOperation(options, scope.lease, context.cwd));
    const destination = await run(() => uploadDestination(op, path, overwrite));
    const prefix = Buffer.from(posix.basename(destination)).subarray(0, 120).toString();
    const temporary = posix.join(posix.dirname(destination), `.${prefix}.prk-upload-${randomUUID()}`);
    let published = false;
    try {
      const opened = await run(() => request(op, "write", { path: temporary, append: false, parents: false, keep: true }));
      const handle = opened.json.handle;
      try {
        let chunk = yield { chunkBytes };
        while (chunk !== undefined) {
          if (!chunk.length || chunk.length > chunkBytes) throw new WireError("INVALID_REQUEST", "Upload chunk is empty or exceeds the negotiated byte limit.");
          const bytes = chunk;
          await run(() => request(op, "writeChunk", { handle }, { payload: bytes, session: opened.session }));
          chunk = yield undefined;
        }
      } finally {
        if (!scope.lease.signal.aborted) await run(() => request(op, "close", { handle }, { session: opened.session }));
      }
      await run(async () => {
        // Like file creation, the public pi-env API has no atomic no-replace operation.
        if (!overwrite && await pathExists(op, destination)) throw exists();
        await request(op, "rename", { path: temporary, to: destination });
      });
      published = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${new Date().toISOString()}] Workspace upload failed at ${temporary}: ${message}`);
      if (error instanceof WireError && error.code !== "UNKNOWN") throw error;
      throw new WireError("UNKNOWN", `${message} Check the destination and temporary path before retrying: ${temporary}`, { temporary });
    } finally {
      if (!published) {
        try {
          if (scope.lease.signal.aborted) throw scope.lease.signal.reason;
          await run(() => request(op, "rm", { path: temporary, force: true }));
        } catch (error) {
          const message = `Upload staging cleanup could not be confirmed: ${temporary}`;
          console.warn(`[${new Date().toISOString()}] ${message}`, error);
          throw new WireError("UNKNOWN", message, { temporary });
        }
      }
    }
  } finally {
    await scope.release();
  }
}

async function uploadDestination(op: FileOperation, path: string, overwrite: boolean): Promise<string> {
  let entry;
  try { entry = await request(op, "lstat", { path }); }
  catch (error) {
    if (error instanceof WireError && error.code === "NOT_FOUND") return path;
    throw error;
  }
  if (!overwrite) throw exists();
  let type = formatMetadata(entry.json, path).type;
  if (type === "symlink") {
    // Existing editor writes follow symlinks; stage beside the referent rather than replacing the link.
    path = (await request(op, "realpath", { path })).json.path as string;
    type = formatMetadata((await request(op, "lstat", { path })).json, path).type;
  }
  if (type !== "file" && type !== "notebook") throw new WireError("INVALID_REQUEST", "Only regular files can be overwritten.");
  return path;
}

function exists(): WireError {
  return new WireError("CONFLICT", "Target path already exists; no file was replaced.");
}
