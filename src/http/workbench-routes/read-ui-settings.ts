import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { responseJson } from "../responses/write-json.ts";

export async function readUiSettings(ctx: RequestContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const { http, gatewayRestart } = ctx;

      if (request.method !== "GET") throw new HttpError(405, "Request method is not supported.");
      responseJson(http, response, 200, { extensionUiRenderIntervalMs: http.extensionUiRenderIntervalMs, gatewayRestartUnit: gatewayRestart.unit || null });
      return;
    
}
