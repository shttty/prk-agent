import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function previewArchive(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  const { gateway, http } = ctx;

      await gatewayResponse(http, response, "Archive preview is unavailable from the Gateway.", () => {
        return gateway.call("archivePreview", { sessionId });
      });
    
}
