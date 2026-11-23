import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function listModels(ctx: RequestContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const { gateway, http } = ctx;

   if (request.method !== "GET") throw new HttpError(405, "Request method is not supported.");
   await gatewayResponse(http, response, "Configured models could not be discovered from the Gateway.", () => gateway.call("modelCatalog", {}));
   return;
  
}
