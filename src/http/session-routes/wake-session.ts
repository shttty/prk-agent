import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";

export async function wakeSession(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  const { gateway, http, limits } = ctx;

      nativeRequest(limits, await readJsonBody(http, request), "wakeSession", sessionId);
      await gatewayResponse(http, response, "Session wake was not confirmed by the Gateway.", () => {
        return gateway.call("wakeSession", { sessionId });
      });
    
}
