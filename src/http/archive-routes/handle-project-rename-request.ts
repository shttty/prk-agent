import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../listener/listener-state.ts";
import { HttpError } from "../request/create-error.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function handleProjectRenameRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, projectId: string): Promise<void> {
  if (request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
  const body = await readJsonBody(ctx.http, request);
  if (Object.hasOwn(body, "projectId")) throw new HttpError(400, "Project identity belongs in the route, not the JSON body.");
  const params = nativeRequest(ctx.limits, { ...body, projectId }, "renameProject");
  await gatewayResponse(ctx.http, response, "Project rename failed.", () => ctx.gateway.call("renameProject", params));
}
