import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function readHistory(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string, url: URL): Promise<void> {
  const { gateway, http } = ctx;

      await gatewayResponse(http, response, "Session history is unavailable from the Gateway.", () => {
        return gateway.call("history", { sessionId });
      });
    
}
