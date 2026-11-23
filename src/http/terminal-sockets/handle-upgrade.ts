import type { ListenerContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { HttpError } from "../request/create-error.ts";
import { routePath } from "../request/parse-request-url.ts";
import { validateBrowserRequest } from "../listener/validate-browser-request.ts";
import { terminalSocketRoute } from "../../workspace/http-routes/terminal-socket-route.ts";
import { decodeRouteIdentity } from "../request/decode-route-identity.ts";
import { STATUS_CODES } from "node:http";

export function handleUpgrade(ctx: ListenerContext, request: IncomingMessage, socket: Duplex, head: Buffer): void {
    try {
      if (ctx.stopping) throw new HttpError(503, "Web service is shutting down.");
      const url = routePath(ctx.limits, request, ctx.origin);
      validateBrowserRequest(ctx, request, true);
      const route = request.method === "GET" ? terminalSocketRoute(url.pathname) : undefined;
      if (!route) throw new HttpError(404, "Endpoint not found.");
      if ([...url.searchParams.keys()].some((key) => key !== "generation") || url.searchParams.getAll("generation").length > 1) throw new HttpError(400, "Invalid terminal query.");
      const generation = url.searchParams.get("generation");
      if (generation !== null && (!generation || generation.length > ctx.limits.identityChars || /[\x00-\x1f\x7f]/u.test(generation))) throw new HttpError(400, "Invalid terminal generation.");
      ctx.terminalSockets!.upgrade(request, socket, head, decodeRouteIdentity(ctx.limits, route.sessionId), decodeRouteIdentity(ctx.limits, route.name), generation ?? undefined);
    } catch (error: unknown) {
      const status = error instanceof HttpError ? error.status : 400;
      socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status] ?? "Error"}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    }
  }
