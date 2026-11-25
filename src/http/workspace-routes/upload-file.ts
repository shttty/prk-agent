import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../listener/listener-state.ts";
import { HttpError } from "../request/create-error.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { gatewayFailure } from "../request/translate-gateway-failure.ts";
import { responseJson } from "../responses/write-json.ts";
import { readUploadBody } from "../request/read-upload-body.ts";

export async function uploadFile({ gateway, http, limits }: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string, query: URLSearchParams): Promise<void> {
  const abort = new AbortController();
  const stop = () => abort.abort();
  response.once("close", stop);
  if (response.destroyed) stop();
  try {
    if (request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/octet-stream") {
      throw new HttpError(415, "Upload requires application/octet-stream.");
    }
    if (request.headers["content-encoding"] !== undefined && request.headers["content-encoding"] !== "identity") {
      throw new HttpError(415, "Compressed request bodies are not supported.");
    }
    const overwrite = query.get("overwrite");
    if (query.size !== (overwrite === null ? 2 : 3) || !query.has("target") || !query.has("path") || (overwrite !== null && overwrite !== "true")) {
      throw new HttpError(400, "Upload requires one target and path, with optional overwrite=true.");
    }
    const params = nativeRequest(limits, { target: query.get("target"), path: query.get("path"), overwrite: overwrite === "true" }, "filesUpload", sessionId);
    await gateway.uploadFile({ ...params, sessionId }, abort.signal, readUploadBody(request, http.uploadIdleTimeoutMs));
    responseJson(http, response, 200, { uploaded: true });
  } catch (error) {
    // IncomingMessage can be destroyed after a normal EOF; the response is still writable.
    if (abort.signal.aborted || response.destroyed) return;
    throw gatewayFailure(error, "Target file upload failed.");
  } finally {
    response.off("close", stop);
  }
}
