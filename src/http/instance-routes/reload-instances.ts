import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { exactKeys } from "../request/inspect-request-keys.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function reloadInstances(ctx: RequestContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const { gateway, http } = ctx;

      if (request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
      const body = await readJsonBody(http, request);
      if (!exactKeys(body, [])) throw new HttpError(400, "Target reload accepts exactly {}.");
      await gatewayResponse(http, response, "Target configuration reload was not confirmed; inspect the current workbench before retrying.", () => {
        return gateway.call("reloadTargets", {});
      });
      return;
    
}
