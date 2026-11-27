import type { RequestContext } from "../listener/listener-state.ts";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

/** `GET /prompt/tools`, `/prompt/raw` and `/prompt/messages?offset=&limit=`: one whole part of the session's latest request. */
export async function readPromptPart(ctx: RequestContext, response: ServerResponse, sessionId: string, part: string, url: URL): Promise<void> {
  const query = url.searchParams;
  const paged = part === "messages";
  if ([...query.keys()].some((key) => !paged || (key !== "offset" && key !== "limit")) || query.getAll("offset").length > 1 || query.getAll("limit").length > 1) {
    throw new HttpError(400, "Only prompt/messages takes the optional offset and limit query parameters.");
  }
  const number = (key: string) => query.has(key) ? { [key]: /^[0-9]{1,10}$/u.test(query.get(key)!) ? Number(query.get(key)) : -1 } : {};
  const params = nativeRequest(ctx.limits, { part, ...number("offset"), ...number("limit") }, "sessionPromptPart", sessionId);
  await gatewayResponse(ctx.http, response, "Session prompt is unavailable from the Gateway.", () => ctx.gateway.call("sessionPromptPart", { sessionId, ...params }));
}
