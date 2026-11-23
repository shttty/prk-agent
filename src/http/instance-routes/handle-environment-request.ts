import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../listener/listener-state.ts";
import { HttpError } from "../request/create-error.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { responseJson } from "../responses/write-json.ts";
import { gatewayFailure } from "../request/translate-gateway-failure.ts";
import { object } from "../../gateway/wire/is-record.ts";
import { isBunPackagePins, type BunPackagePins } from "../../config/execution-target/validation/bun-package-options.ts";

export async function handleEnvironmentRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, target: string): Promise<void> {
  if (request.method !== "GET" && request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
  let bunPackages: BunPackagePins | undefined;
  if (request.method === "POST") {
    const body = await readJsonBody(ctx.http, request);
    if (!object(body) || Object.keys(body).some((key) => key !== "bunPackages")
        || (body.bunPackages !== undefined && !isBunPackagePins(body.bunPackages))) throw new HttpError(400, "Invalid environment deployment parameters.");
    bunPackages = body.bunPackages;
  }
  try {
    const snapshot = await ctx.gateway.call(request.method === "POST" ? "deployTargetEnvironment" : "getTargetEnvironment",
      { target, ...(bunPackages && { bunPackages }) });
    responseJson(ctx.http, response, request.method === "POST" ? 202 : 200, snapshot);
  } catch (error) { throw gatewayFailure(error, "Instance environment operation failed."); }
}
