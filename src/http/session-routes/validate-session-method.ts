import type { IncomingMessage } from "node:http";
import { HttpError } from "../request/create-error.ts";

export function validateSessionMethod(request: IncomingMessage, action: string | undefined): void {
if (action === undefined) {
      if (request.method !== "GET") throw new HttpError(405, "Request method is not supported.");
    } else {
      const expectedMethod = action === "events" || action === "history" || action === "history-page" || action === "tool-content" || action === "kernel/result" || action === "archive-preview" ? "GET" : action === "project" ? "PATCH" : action === "native" ? undefined : "POST";
      if (action === "native" ? (request.method !== "GET" && request.method !== "POST") : request.method !== expectedMethod) throw new HttpError(405, "Request method is not supported.");
    }
}
