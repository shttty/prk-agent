import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { routeCodeModePath } from "./parse-resource-route.ts";
import { HttpError } from "../request/create-error.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { exactKeys } from "../request/inspect-request-keys.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function handleResourceRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, codeModeRoute: NonNullable<ReturnType<typeof routeCodeModePath>>): Promise<void> {
  const { gateway, http, limits } = ctx;

      if (request.method !== codeModeRoute.verb) throw new HttpError(405, "Request method is not supported.");
      const body = codeModeRoute.verb === "POST" ? await readJsonBody(http, request) : {};
      if (codeModeRoute.method === "skillsScope" && !exactKeys(body, ["scope"])) throw new HttpError(400, "Skill scope changes accept exactly a scope field.");
      if (Object.hasOwn(body, "sessionId") || (codeModeRoute.name !== undefined && Object.hasOwn(body, "name"))) {
        throw new HttpError(400, "Session and tool routing identities belong in the route, not the JSON body.");
      }
      const params = nativeRequest(limits, codeModeRoute.name === undefined ? body : { ...body, name: codeModeRoute.name }, codeModeRoute.method, codeModeRoute.sessionId);
      await gatewayResponse(http, response, "Code-mode operation failed; inspect current state before retrying.", () => {
        return gateway.call(codeModeRoute.method, codeModeRoute.sessionId === undefined ? params : { ...params, sessionId: codeModeRoute.sessionId });
      });
      return;
    
}
