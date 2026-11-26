import type { RequestContext } from "../listener/listener-state.ts";
import type { ServerResponse } from "node:http";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function readPrompt(ctx: RequestContext, response: ServerResponse, sessionId: string): Promise<void> {
  await gatewayResponse(ctx.http, response, "Session prompt is unavailable from the Gateway.", () => ctx.gateway.call("sessionPrompt", { sessionId }));
}
