import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { requireConfirmation } from "../request/require-confirmation.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function archiveSession(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  const { gateway, http } = ctx;

      requireConfirmation(await readJsonBody(http, request), "Archiving requires exactly {confirm:true}.");
      await gatewayResponse(http, response, "Session could not be archived by the Gateway.", async () => {
        await gateway.call("archiveSession", { sessionId, confirm: true });
        return { ok: true };
      });
    
}
