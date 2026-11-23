import type { HttpOptions } from "../../config/http/http-options.ts";
import type { ServerResponse } from "node:http";
import { API_HEADERS } from "../request/response-constants.ts";

export function openEventStream(http: HttpOptions, response: ServerResponse): void {
  if (response.headersSent) return;
  response.setTimeout(http.streamTimeoutMs);
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    ...API_HEADERS,
  });
  response.flushHeaders();
}
