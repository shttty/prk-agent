import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { exactRequest } from "../request/validate-exact-request.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import type { ExecutionTargetConfig } from "../../config/execution-target/target-types.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function addInstance(ctx: RequestContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const { gateway, http, limits } = ctx;

      if (request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
      const target = exactRequest(limits, await readJsonBody(http, request), "addTarget", ["target"], "Target creation accepts exactly {target}.").target as ExecutionTargetConfig;
      await gatewayResponse(http, response, "Target was not added; inspect the current workbench before retrying.", () => {
        return gateway.call("addTarget", { target });
      });
      return;
    
}
