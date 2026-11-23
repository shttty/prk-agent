import type { RequestContext } from "../listener/listener-state.ts";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function readHistoryPage(ctx: RequestContext, response: ServerResponse, sessionId: string, url: URL): Promise<void> {
  const [key, ...rest] = url.searchParams.keys();
  if (rest.length || (key !== "before" && key !== "through")) {
    throw new HttpError(400, "History page requires exactly one before or through query parameter.");
  }
  const cursor = url.searchParams.get(key);
  const params = nativeRequest(ctx.limits, { [key]: key === "through" && cursor === "" ? null : cursor }, "historyPage", sessionId);
  await gatewayResponse(ctx.http, response, "History page is unavailable from the Gateway.", () => ctx.gateway.call("historyPage", { sessionId, ...params }));
}
