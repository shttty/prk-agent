import { once } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { create as contentDisposition } from "content-disposition";
import mime from "mime";
import type { DownloadMetadata } from "../../workspace/target-files/files-types.ts";
import type { RequestContext } from "../listener/listener-state.ts";
import { HttpError } from "../request/create-error.ts";
import { readRequestBody } from "../request/read-request-body.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { gatewayFailure } from "../request/translate-gateway-failure.ts";

export async function downloadFile({ gateway, http, limits }: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  if (request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/x-www-form-urlencoded") {
    throw new HttpError(415, "Download requires a URL-encoded form.");
  }
  const fields = new URLSearchParams((await readRequestBody(http, request)).toString("utf8"));
  if (fields.size !== 2 || !fields.has("path") || !fields.has("target")) throw new HttpError(400, "Download requires exactly one path and target.");
  const params = nativeRequest(limits, Object.fromEntries(fields), "filesDownload", sessionId);
  const abort = new AbortController();
  const stop = () => abort.abort();
  response.once("close", stop);
  if (response.destroyed) stop();
  let metadata: DownloadMetadata;
  const writeHeaders = () => {
    response.strictContentLength = true;
    response.writeHead(200, {
      "Content-Disposition": contentDisposition(metadata.name),
      "Content-Type": mime.getType(metadata.name) ?? "application/octet-stream",
      "Content-Length": metadata.size,
    });
  };
  try {
    await gateway.downloadFile({ ...params, sessionId }, abort.signal, {
      open: (value) => { metadata = value; },
      async write(bytes) {
        abort.signal.throwIfAborted();
        if (!response.headersSent) writeHeaders();
        if (!response.write(bytes)) await once(response, "drain", { signal: abort.signal });
      },
    });
    if (response.destroyed) return;
    if (!response.headersSent) writeHeaders(); // Empty file.
    response.end();
  } catch (error) {
    if (abort.signal.aborted) return;
    if (response.headersSent) {
      console.warn(`[${new Date().toISOString()}] Workspace download interrupted: ${error instanceof Error ? error.message : String(error)}`);
      response.destroy();
      return;
    }
    throw gatewayFailure(error, "Target file download could not be started.");
  } finally {
    response.off("close", stop);
  }
}
