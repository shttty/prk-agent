import type { IncomingMessage, ServerResponse } from "node:http";
import type { DerivationConfig } from "../../config/derivation/derivation-types.ts";
import type { RequestContext } from "../listener/listener-state.ts";
import { HttpError } from "../request/create-error.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function handleDerivationRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "GET" && request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
  const change = request.method === "POST"
    ? nativeRequest(ctx.limits, await readJsonBody(ctx.http, request), "derivationSet") as { derivation: DerivationConfig }
    : undefined;
  await gatewayResponse(ctx.http, response, "Derivation settings are unavailable from the Gateway.", async () => {
    if (change === undefined) {
      return ctx.gateway.call("derivationGet", {});
    }
    return ctx.gateway.call("derivationSet", { ...change });
  });
}
