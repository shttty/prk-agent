import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../listener/listener-state.ts";
import { HttpError } from "../request/create-error.ts";
import { readRequestBody } from "../request/read-request-body.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { streamDownload } from "./stream-download.ts";

export async function downloadFile({ gateway, http, limits }: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  if (request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/x-www-form-urlencoded") {
    throw new HttpError(415, "Download requires a URL-encoded form.");
  }
  const fields = new URLSearchParams((await readRequestBody(http, request)).toString("utf8"));
  if (fields.size !== 2 || !fields.has("path") || !fields.has("target")) throw new HttpError(400, "Download requires exactly one path and target.");
  const params = nativeRequest(limits, Object.fromEntries(fields), "filesDownload", sessionId);
  return streamDownload(gateway, response, { ...params, sessionId });
}
