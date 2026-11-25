import type { IncomingMessage } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { readUploadBody } from "../request/read-upload-body.ts";

export async function* artifactUploadBody(request: IncomingMessage, declaredLength: number | undefined, idleTimeoutMs: number): AsyncGenerator<Uint8Array> {
  let size = 0;
  try {
    for await (const bytes of readUploadBody(request, idleTimeoutMs)) {
      size += bytes.byteLength;
      yield bytes;
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Artifact upload body could not be read.");
  }
  if (declaredLength !== undefined && declaredLength !== size) throw new HttpError(400, "Content-Length does not match the request body.");
}
