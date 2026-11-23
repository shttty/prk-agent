import type { HttpOptions } from "../../config/http/http-options.ts";
import type { IncomingMessage } from "node:http";
import { HttpError } from "./create-error.ts";
import { contentLength } from "./read-content-length.ts";
import type { BodyContext } from "./request-state.ts";
import { onData } from "./body/on-data.ts";
import { onEnd } from "./body/on-end.ts";
import { onAborted } from "./body/on-aborted.ts";
import { onError } from "./body/on-error.ts";

export async function readRequestBody(http: HttpOptions, request: IncomingMessage): Promise<Buffer> {
  if (request.headers["content-encoding"] !== undefined && request.headers["content-encoding"] !== "identity") {
    throw new HttpError(415, "Compressed request bodies are not supported.");
  }
  const declaredLength = contentLength(http, request);
  return new Promise<Buffer>((resolve, reject) => {
    const ctx: BodyContext = { http, request, declaredLength, chunks: [], size: 0, settled: false, resolve, reject,
      onData: (chunk) => onData(ctx, chunk), onEnd: () => onEnd(ctx), onAborted: () => onAborted(ctx), onError: () => onError(ctx) };
    request.on("data", ctx.onData);
    request.once("end", ctx.onEnd);
    request.once("aborted", ctx.onAborted);
    request.once("error", ctx.onError);
    if (declaredLength === 0) request.resume();
  });
}
