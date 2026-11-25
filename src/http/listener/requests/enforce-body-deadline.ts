import type { IncomingMessage, ServerResponse } from "node:http";
import type { HttpOptions } from "../../../config/http/http-options.ts";
import { responseJson } from "../../responses/write-json.ts";

export function enforceBodyDeadline(http: HttpOptions, request: IncomingMessage, response: ServerResponse): void {
  if (request.complete) return;
  const timer = setTimeout(() => {
    if (request.complete || request.destroyed) return;
    if (response.headersSent || !response.socket || response.destroyed) {
      request.destroy();
      return;
    }
    // Stop reading before replying so a late body cannot reach the handler after the 408.
    request.socket.pause();
    try {
      response.setHeader("Connection", "close");
      responseJson(http, response, 408, { error: "Request body deadline exceeded." });
    } catch {
      request.destroy();
    }
  }, http.requestTimeoutMs);
  timer.unref();
  request.once("close", () => clearTimeout(timer));
}
