import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { exactRequest } from "../request/validate-exact-request.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function assignSessionProject(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  const { gateway, http, limits } = ctx;

      const project = exactRequest(limits, await readJsonBody(http, request), "assignProject", ["project"], "Project assignment accepts exactly {project}.", sessionId).project as { id: string; name: string } | null;
      await gatewayResponse(http, response, "Project membership was not changed by the Gateway.", () => {
        return gateway.call("assignProject", { sessionId, project });
      });
    
}
