import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import type { SessionManagementRequest } from "../../gateway/wire/wire-types.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function manageSessionRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  const { gateway, http, limits } = ctx;

      const management = nativeRequest(limits, await readJsonBody(http, request), "manageSession", sessionId) as unknown as SessionManagementRequest;
      await gatewayResponse(http, response, "Session management was not confirmed by the Gateway; inspect the workbench before retrying.", () => {
        return gateway.call("manageSession", { sessionId, ...management });
      });
    
}
