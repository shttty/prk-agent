import type { ListenerContext } from "./listener-state.ts";
import type { IncomingMessage } from "node:http";
import { HttpError } from "../request/create-error.ts";

export function validateBrowserRequest(ctx: ListenerContext, request: IncomingMessage, mutation: boolean): void {
    let expectedOrigin = ctx.origin;
    let expectedAuthority = ctx.authority;
    if (ctx.host === "0.0.0.0") {
      let requested: URL;
      try {
        if (!request.headers.host) throw new Error("Missing Host");
        requested = new URL(`http://${request.headers.host}`);
      } catch {
        throw new HttpError(400, "Invalid Host header.");
      }
      if (requested.username || requested.password || requested.pathname !== "/" || requested.search || requested.hash) {
        throw new HttpError(400, "Invalid Host header.");
      }
      expectedOrigin = requested.origin;
      expectedAuthority = request.headers.host;
    }
    if (request.headers.host !== expectedAuthority) throw new HttpError(403, "Host header does not match the private web listener.");
    const suppliedOrigin = request.headers.origin;
    if (suppliedOrigin !== undefined && suppliedOrigin !== expectedOrigin) throw new HttpError(403, "Origin is not allowed.");
    if (mutation && suppliedOrigin !== expectedOrigin) throw new HttpError(403, "Mutating requests require the exact workbench Origin.");
    if (request.headers["sec-fetch-site"] === "cross-site") throw new HttpError(403, "Cross-origin requests are not allowed.");
  }
