import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleProjectArchiveRequest } from "./handle-project-archive-request.ts";
import { routeArchivePath } from "./parse-archive-route.ts";
import { handleArchiveRequest } from "./handle-archive-request.ts";

export async function dispatchArchiveRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, path: string): Promise<boolean> {
  if (path.startsWith("/api/projects/")) {
    await handleProjectArchiveRequest(ctx, request, response, path);
    return true;
  }
  const route = routeArchivePath(ctx.limits, path);
  if (!route) return false;
  await handleArchiveRequest(ctx, request, response, route);
  return true;
}
