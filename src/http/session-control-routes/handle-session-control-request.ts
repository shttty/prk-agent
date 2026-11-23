import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../listener/listener-state.ts";
import { HttpError } from "../request/create-error.ts";
import { exactRequest } from "../request/validate-exact-request.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function handleSessionControlRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  if (url.search) throw new HttpError(400, "Session control routes do not accept query parameters.");
  const { gateway, http, limits } = ctx;
  // The router passes only the two setters; roles are read with the workbench snapshot and `session_control_changed`.
  const action = url.pathname === "/api/session-control/root" ? "setSessionRoot" : "setProjectSupervisor";
  if (request.method !== "POST") throw new HttpError(405, "Session roles are changed with POST.");
  const params = exactRequest(limits, await readJsonBody(http, request), action, ["sessionId"], "Role designation accepts exactly {sessionId}.");
  await gatewayResponse(http, response, "Session role was not changed by the Gateway.", () => {
    return gateway.call(action, { sessionId: params.sessionId });
  });
}
