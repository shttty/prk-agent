import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../listener/listener-state.ts";
import { HttpError } from "../request/create-error.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function handleToolTitleRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "GET" && request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
  const change = request.method === "POST"
    ? nativeRequest(ctx.limits, await readJsonBody(ctx.http, request), "toolTitleSet")
    : undefined;
  await gatewayResponse(ctx.http, response, "Tool title settings are unavailable from the Gateway.", () =>
    change === undefined ? ctx.gateway.call("toolTitleGet", {}) : ctx.gateway.call("toolTitleSet", change));
}
