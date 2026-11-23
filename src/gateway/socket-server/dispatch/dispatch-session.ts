import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import { object } from "../../wire/is-record.ts";
import type { NativeActionRequest, ExtendedSendRequest } from "../../wire/wire-types.ts";
import type { CancelRequest } from "../../../sessions/host/operations/cancel-types.ts";

export async function dispatchSession(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  const { id, method, params } = request;
  const { host } = ctx.listener;
      if (method === "nativeCapabilities") {
        respond(id, host.nativeCapabilities(params.sessionId as string)); return;
      }
      if (method === "nativeAction") {
        respond(id, await host.nativeAction(params.sessionId as string, params as unknown as NativeActionRequest)); return;
      }
      if (method === "kernelVariables") { respond(id, host.kernelVariables(params.sessionId as string)); return; }
      if (method === "kernelDeleteVariable") { respond(id, await host.kernelDeleteVariable(params.sessionId as string, params.name as string)); return; }
      if (method === "kernelInterrupt") {
        respond(id, await host.session(params.sessionId as string).interruptCell({ kernelId: params.kernelId as string, cellId: params.cellId as string, ...(params.cellOnly === true ? { cellOnly: true } : {}) })); return;
      }
      if (method === "state") {
        respond(id, host.state(params.sessionId as string)); return;
      }
      if (method === "messages") {
        const snapshot = host.state(params.sessionId as string);
        const { sessionId, streamId, sequence, messages } = snapshot; respond(id, { sessionId, streamId, sequence, messages }); return;
      }
      if (method === "send") {
        const result = await host.nativeSend(params.sessionId as string, params as unknown as ExtendedSendRequest);
        if (object(result) && result.accepted === true && "completion" in result) {
          const { completion: _, ...accepted } = result;
          respond(id, accepted);
        } else respond(id, result);
      } else if (method === "cancel") {
        const { completion: _, ...result } = await host.session(params.sessionId as string).cancel({ operationId: params.operationId as string, ...(params.cell === undefined ? {} : { cell: params.cell as CancelRequest["cell"] }) }); respond(id, result);
      } else if (method === "reload") { await host.session(params.sessionId as string).reload(); respond(id, { reloaded: true }); }
      else if (method === "closeSession") { await host.closeSession(params.sessionId as string); respond(id, { closed: true }); }
}
