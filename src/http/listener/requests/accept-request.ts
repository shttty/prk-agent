import type { ListenerContext } from "../listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { responseJson } from "../../responses/write-json.ts";
import { handleRequest } from "./handle-request.ts";
import { HttpError } from "../../request/create-error.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { ArtifactError } from "../../../artifacts/upload-error/create-artifact-error.ts";

export function acceptRequest(ctx: ListenerContext, request: IncomingMessage, response: ServerResponse): void {
    if (ctx.responses.size >= ctx.http.connectionsMax) {
      response.setHeader("Connection", "close");
      responseJson(ctx.http, response, 503, { error: "Too many active web connections." });
      return;
    }
    ctx.responses.add(response);
    response.once("close", () => ctx.responses.delete(response));
    void handleRequest(ctx, request, response).catch((error: unknown) => {
      if (response.headersSent || response.destroyed) {
        response.destroy();
        return;
      }
      const known = error instanceof HttpError || error instanceof WireError || error instanceof ArtifactError;
      const status = error instanceof HttpError || error instanceof ArtifactError ? error.status : error instanceof WireError ? 400 : 500;
      if (!known) console.error(`[${new Date().toISOString()}] Web request failed; inspect the current Gateway session state.`);
      try {
        if (!request.complete || status === 408) response.setHeader("Connection", "close");
        responseJson(ctx.http, response, status, { error: known ? error.message : "Web operation failed; inspect current session and kernel state before retrying.",
          ...(error instanceof HttpError && error.code ? { code: error.code, ...(error.details ? { details: error.details } : {}) } : {}) });
      } catch {
        response.destroy();
      }
    });
  }
