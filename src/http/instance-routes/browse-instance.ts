import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { exactRequest } from "../request/validate-exact-request.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function browseInstance(ctx: RequestContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const { gateway, http, limits } = ctx;

      if (request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
      const { connection, path: directory } = exactRequest(limits, await readJsonBody(http, request), "browseTarget", ["connection", "path"], "Target browsing accepts exactly {connection,path}.");
      await gatewayResponse(http, response, "Target directory browsing failed; no session or kernel was created.", () => {
        return gateway.call("browseTarget", { connection: connection as Record<string, unknown>, path: directory as string });
      });
      return;
    
}
