import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function refreshCapabilities(ctx: RequestContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const { gateway, http, limits } = ctx;

      if (request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
      const body = nativeRequest(limits, await readJsonBody(http, request), "capabilitiesRefresh");
      await gatewayResponse(http, response, "Capability inventory could not be refreshed from the Gateway.", () => {
        return gateway.call("capabilitiesRefresh", body.instance === undefined ? {} : { instance: body.instance });
      });
      return;
    
}
