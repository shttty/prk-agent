import type { IncomingMessage } from "node:http";
import { HttpError } from "../request/create-error.ts";

export async function* artifactUploadBody(request: IncomingMessage, declaredLength: number | undefined): AsyncGenerator<Uint8Array> {
  let size = 0;
  try {
    // Keep the response socket alive when the store rejects an over-limit stream.
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      const bytes = chunk as Buffer;
      size += bytes.byteLength;
      yield bytes;
    }
  } catch {
    throw new HttpError(400, "Artifact upload body could not be read.");
  }
  if (declaredLength !== undefined && declaredLength !== size) throw new HttpError(400, "Content-Length does not match the request body.");
}
