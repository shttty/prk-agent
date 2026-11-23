import type { PeerContext, Respond } from "../socket-server/connection/peer-state.ts";
import type { Request } from "../wire/wire-types.ts";

export function dispatchSessionControl(ctx: PeerContext, respond: Respond, request: Request): void {
  const { id, method, params } = request;
  const { host } = ctx.listener;
  if (method === "sessionControl") respond(id, host.sessionControl());
  else if (method === "setSessionRoot") respond(id, host.setSessionRoot({ sessionId: params.sessionId as string }));
  else if (method === "setProjectSupervisor") respond(id, host.setProjectSupervisor({ sessionId: params.sessionId as string }));
}
