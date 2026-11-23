import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { decodeRouteIdentity } from "../request/decode-route-identity.ts";
import { requireConfirmation } from "../request/require-confirmation.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";
import { handleProjectRenameRequest } from "./handle-project-rename-request.ts";

export async function handleProjectArchiveRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, path: string): Promise<void> {
  const [rawId, action, extra] = path.slice("/api/projects/".length).split("/");
  if (!rawId || extra !== undefined || !["archive", "archive-preview", "rename"].includes(action!)) throw new HttpError(404, "Endpoint not found.");
  const projectId = decodeRouteIdentity(ctx.limits, rawId);
  if (action === "rename") return handleProjectRenameRequest(ctx, request, response, projectId);
  const preview = action === "archive-preview";
  if (request.method !== (preview ? "GET" : "POST")) throw new HttpError(405, "Request method is not supported.");
  const method = preview ? "archiveProjectPreview" : "archiveProject";
  const params = preview ? { projectId } : { projectId, confirm: true };
  nativeRequest(ctx.limits, params, method);
  if (!preview) requireConfirmation(await readJsonBody(ctx.http, request), "Archiving requires exactly {confirm:true}.");
  await gatewayResponse(ctx.http, response, "Project archive operation failed.", () => ctx.gateway.call(method, params));
}
