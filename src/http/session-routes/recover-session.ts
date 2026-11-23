import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { recoverSessionRequest } from "./lifecycle/parse-recovery-request.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import { object } from "../../gateway/wire/is-record.ts";

export async function recoverSession(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  const { gateway, http, limits } = ctx;

      const recovery = recoverSessionRequest(limits, await readJsonBody(http, request), sessionId);
      await gatewayResponse(http, response, "Session recovery was not accepted by the Gateway; inspect session state before retrying.", async () => {
        const recovered = await gateway.call("recoverSession", { sessionId, ...recovery });
        if (!object(recovered) || !object(recovered.session) || !object(recovered.snapshot)) {
          throw new WireError("HOST_ERROR", "Gateway did not return a recovered session; inspect the workbench before retrying.");
        }
        return recovered;
      });
    
}
