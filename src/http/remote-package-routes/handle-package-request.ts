import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function handlePackageRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, _url: URL, path: string): Promise<void> {
  const { gateway, http, limits } = ctx;
  const listing = path === "/api/plugins";
  if (request.method !== (listing ? "GET" : "POST")) throw new HttpError(405, "Request method is not supported.");
  const method = listing ? "pluginsList" : path.endsWith("/install") ? "pluginsInstall" : path.endsWith("/uninstall") ? "pluginsUninstall" : "pluginsChange";
  const body = nativeRequest(limits, listing ? {} : await readJsonBody(http, request), method);
  await gatewayResponse(http, response, "Plugin configuration is unavailable.", () => gateway.call(method, { ...body }));
}
