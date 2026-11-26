import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

/** POST, not GET: answering for an unseen requestId withdraws it on the Gateway. */
export async function readSendStatus(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  const { gateway, http, limits } = ctx;
  const body = nativeRequest(limits, await readJsonBody(http, request), "sendStatus", sessionId);
  await gatewayResponse(http, response, "Send status is unavailable; the send result is still unknown.", () => gateway.call("sendStatus", { sessionId, ...body }));
}
