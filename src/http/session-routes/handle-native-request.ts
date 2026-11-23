import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import type { NativeActionRequest } from "../../gateway/wire/wire-types.ts";

export async function handleNativeRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string, url: URL): Promise<void> {
  const { gateway, http, limits } = ctx;

      await gatewayResponse(http, response, "Native interaction was not confirmed by the Gateway; inspect the current session before retrying.", async () => {
        if (request.method === "GET") {
          return gateway.call("nativeCapabilities", { sessionId });
        }
        const params = nativeRequest(limits, await readJsonBody(http, request), "nativeAction", sessionId) as unknown as Omit<NativeActionRequest, "sessionId">;
        return gateway.call("nativeAction", { sessionId, ...params });
      });
    
}
