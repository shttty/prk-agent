import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { workspaceHttpRoute } from "../../workspace/http-routes/workspace-http-route.ts";
import { HttpError } from "../request/create-error.ts";
import { decodeRouteIdentity } from "../request/decode-route-identity.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { responseJson } from "../responses/write-json.ts";
import { uploadFile } from "./upload-file.ts";
import { downloadFile } from "./download-file.ts";
import { gatewayFailure } from "../request/translate-gateway-failure.ts";

export async function handleWorkspaceRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, workspaceRoute: NonNullable<ReturnType<typeof workspaceHttpRoute>>, query: URLSearchParams): Promise<void> {
  const { gateway, http, limits } = ctx;

      if (request.method !== workspaceRoute.verb) throw new HttpError(405, "Request method is not supported.");
      const sessionId = decodeRouteIdentity(limits, workspaceRoute.sessionId);
      if (workspaceRoute.method === "filesUpload") return uploadFile(ctx, request, response, sessionId, query);
      if (workspaceRoute.method === "filesDownload") return downloadFile(ctx, request, response, sessionId);
      const body = workspaceRoute.verb === "POST" ? await readJsonBody(http, request) : {};
      if (Object.hasOwn(body, "sessionId")) throw new HttpError(400, "Workspace sessionId identity belongs in the route, not the JSON body.");
      const params = nativeRequest(limits, body, workspaceRoute.method, sessionId);
      try {
        responseJson(http, response, 200, await gateway.call(workspaceRoute.method, { ...params, sessionId }));
      } catch (error) { throw gatewayFailure(error, "Target workspace operation failed; inspect current state before retrying."); }
      return;
    
}
