import { RemoteError, type RequestOptions } from "@earendil-works/pi-env";
import { WireError } from "../../gateway/wire/create-error.ts";
import type { FileOperation } from "./files-types.ts";

export async function request(op: FileOperation, method: string, fields: Record<string, unknown>, options: RequestOptions = {}) {
  if (Buffer.byteLength(JSON.stringify({ op: method, ...fields })) + (options.payload?.byteLength ?? 0) + 9 > 16777216) {
    throw new WireError("TOO_LARGE", "Target file request exceeds the pi-env protocol frame limit.");
  }
  try { return await op.connection.request(method, fields, { ...op.requestOptions, ...options }); }
  catch (error) {
    if (!(error instanceof RemoteError)) throw error;
    const reason = error.code === "ENOENT" ? "not-found" : error.code === "EACCES" || error.code === "EPERM" ? "forbidden"
      : error.code === "ENOTDIR" ? "not-directory" : "failed";
    const code = error.code === "ENOENT" ? "NOT_FOUND" : error.code === "EEXIST" ? "CONFLICT"
      : ["ENOTDIR", "EISDIR", "EINVAL", "ENOTEMPTY"].includes(error.code) ? "INVALID_REQUEST"
      : ["unknown", "aborted", "timeout"].includes(error.code) ? "UNKNOWN" : "HOST_ERROR";
    throw new WireError(code, error.message, { reason });
  }
}
