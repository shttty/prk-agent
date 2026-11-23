import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function readToolContent(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string, url: URL): Promise<void> {
  const { gateway, http, limits } = ctx;

      const params = nativeRequest(limits, { toolCallId: url.searchParams.get("toolCallId") }, "toolContent", sessionId);
      await gatewayResponse(http, response, "Tool content is unavailable from the Gateway.", () => {
        return gateway.call("toolContent", { sessionId, toolCallId: params.toolCallId as string });
      });
    
}
