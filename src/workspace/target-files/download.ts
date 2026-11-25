import { WireError } from "../../gateway/wire/create-error.ts";
import type { FilesState, TargetFileContext, FileDownload } from "./files-types.ts";
import { absolutePath } from "../target-paths/absolute-path.ts";
import { acquireOperation } from "./acquire-operation.ts";
import { prepareOperation } from "./prepare-operation.ts";
import { withDeadline } from "./with-deadline.ts";
import { request } from "./request.ts";
import { formatMetadata } from "./format-metadata.ts";
import { readChunk } from "./read-chunk.ts";

export async function* download(state: FilesState, context: TargetFileContext, path: string, wireChunkBytes: number): FileDownload {
  absolutePath(path);
  const { options } = state;
  const maxChunk = Math.min(options.workspace.fileChunkBytes, wireChunkBytes);
  if (maxChunk < 1) throw new WireError("TOO_LARGE", "Gateway frame budget is too small for a file download.");
  const scope = await acquireOperation(state, context);
  try {
    // Only a target operation has a deadline; time waiting for the browser to drain is not a target failure.
    const run = <T>(work: () => Promise<T>) => withDeadline(scope.lease, options.targetConnection.requestTimeoutMs, work);
    const [op, opened] = await run(async () => {
      const op = await prepareOperation(options, scope.lease, context.cwd);
      return [op, await request(op, "open", { path, noFollow: false })] as const;
    });
    try {
      const { name, size, type } = formatMetadata(opened.json.info, path);
      if (type !== "file" && type !== "notebook") throw new WireError("INVALID_REQUEST", "Only regular files can be downloaded.");
      if (size === null || !Number.isSafeInteger(size) || size < 0) throw new WireError("HOST_ERROR", "Invalid target file length.");
      yield { name, size };
      for (let offset = 0; offset < size;) {
        const chunk = await run(() => readChunk(op, opened, offset, Math.min(maxChunk, size - offset)));
        if (chunk.byteLength === 0) throw new WireError("CONFLICT", "File ended before its declared length during download.");
        offset += chunk.byteLength;
        const data = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString("base64");
        // Return, rather than yield, the last bytes so close/release must succeed before HTTP can complete.
        if (offset === size) return { data };
        yield { data };
      }
      return { data: "" };
    } finally {
      if (!scope.lease.signal.aborted) await run(() => request(op, "close", { handle: opened.json.handle }, { signal: undefined, session: opened.session }));
    }
  } finally {
    await scope.release();
  }
}
