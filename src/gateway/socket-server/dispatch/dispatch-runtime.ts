import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { RecoverSessionRequest } from "../../session-views/session-view-types.ts";

export async function dispatchRuntime(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  const { id, method, params } = request;
  const { host } = ctx.listener;
      if (method === "createSession") {
        respond(id, await host.createSession(params as unknown as Parameters<GatewaySessionHost["createSession"]>[0])); return;
      }
      if (method === "wakeSession") {
        respond(id, await host.wakeSession(params.sessionId as string)); return;
      }
      if (method === "recoverSession") {
        const { sessionId: _sessionId, ...recovery } = params;
        respond(id, await host.recoverSession(params.sessionId as string, recovery as unknown as RecoverSessionRequest)); return;
      }
      if (method === "kernelClear" || method === "kernelRestart") {
        respond(id, await host[method](params.sessionId as string)); return;
      }
      if (method === "monitorFocus") { respond(id, host.monitorFocus(params.sessionId as string, params.open as boolean)); return; }
      if (method === "monitorHistory") { respond(id, host.monitorHistory(params.sessionId as string)); return; }
      if (method === "monitorDiff") { respond(id, await host.monitorDiff(params.sessionId as string, params.path as string)); return; }
}
