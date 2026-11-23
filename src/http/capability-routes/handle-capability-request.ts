import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import type { CapabilitySettingsChange } from "../../config/capabilities/capability-types.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function handleCapabilityRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const { gateway, http, limits } = ctx;

      if (request.method !== "GET" && request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
      const change = request.method === "POST" ? nativeRequest(limits, await readJsonBody(http, request), "capabilitiesChange") as CapabilitySettingsChange : undefined;
      await gatewayResponse(http, response, "Capability settings are unavailable from the Gateway.", () => {
        if (change === undefined) {
          const instance = url.searchParams.get("instance") ?? undefined;
          return gateway.call("capabilitiesList", instance === undefined ? {} : { instance });
        }
        return gateway.call("capabilitiesChange", { ...change });
      });
      return;
    
}
