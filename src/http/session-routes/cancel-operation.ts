import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function cancelOperation(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  const { gateway, http, limits } = ctx;

      const body = nativeRequest(limits, await readJsonBody(http, request), "cancel", sessionId);
      await gatewayResponse(http, response, "Cancellation could not be accepted; inspect session state before retrying.", () => gateway.call("cancel", { sessionId, ...body }));
    
}
