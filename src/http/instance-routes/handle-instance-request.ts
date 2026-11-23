import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";
import { exactRequest } from "../request/validate-exact-request.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import type { ExecutionTargetEdit } from "../../config/execution-target/target-types.ts";
import { HttpError } from "../request/create-error.ts";
import { requireConfirmation } from "../request/require-confirmation.ts";

export async function handleInstanceRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, targetName: string): Promise<void> {
  const { gateway, http, limits } = ctx;

      if (request.method === "GET") {
        await gatewayResponse(http, response, "Target configuration is unavailable from the Gateway.", () => {
          return gateway.call("getTarget", { target: targetName });
        });
        return;
      }
      if (request.method === "PATCH") {
        const target = exactRequest(limits, await readJsonBody(http, request), "editTarget", ["target"], "Target editing accepts exactly {target}.").target as ExecutionTargetEdit;
        if (target.id !== targetName) throw new HttpError(400, "Target ID must match the route identity and remains immutable.");
        await gatewayResponse(http, response, "Target was not changed; inspect the current workbench before retrying.", () => {
          return gateway.call("editTarget", { target });
        });
        return;
      }
      if (request.method !== "DELETE") throw new HttpError(405, "Request method is not supported.");
      requireConfirmation(await readJsonBody(http, request), "Target deletion requires exactly {confirm:true}; history and kernels are never deleted.");
      await gatewayResponse(http, response, "Target deletion was not confirmed; active targets remain unchanged.", () => {
        return gateway.call("deleteTarget", { target: targetName, confirm: true });
      });
      return;
    
}
