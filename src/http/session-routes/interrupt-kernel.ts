import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function interruptKernel(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  const { gateway, http, limits } = ctx;
  const body = nativeRequest(limits, await readJsonBody(http, request), "kernelInterrupt", sessionId);
  await gatewayResponse(http, response, "Kernel interrupt could not be accepted; inspect session state before retrying.",
    () => gateway.call("kernelInterrupt", { sessionId, ...body }));
}
