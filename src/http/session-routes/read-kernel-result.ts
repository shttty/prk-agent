import type { RequestContext } from "../listener/listener-state.ts";
import type { ServerResponse } from "node:http";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";
import { parseKernelResultQuery } from "./parse-kernel-result-query.ts";

export async function readKernelResult(ctx: RequestContext, response: ServerResponse, sessionId: string, url: URL): Promise<void> {
  const params = parseKernelResultQuery(ctx.limits, url, sessionId);
  await gatewayResponse(ctx.http, response, "Kernel result is unavailable from the Gateway.", () => {
    return ctx.gateway.call("kernelResult", { sessionId, ...params });
  });
}
