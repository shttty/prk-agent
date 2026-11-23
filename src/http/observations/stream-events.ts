import type { RequestContext } from "../listener/listener-state.ts";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { gatewayFailure } from "../request/translate-gateway-failure.ts";
import type { StreamContext } from "./observation-state.ts";
import { subscribeWorkbench } from "./collection-stream/subscribe-workbench.ts";
import { subscribeSession } from "./session-stream/subscribe-session.ts";
import { cleanupStream } from "./lifecycle/cleanup.ts";
import { refuseStream } from "./lifecycle/refuse.ts";

export async function streamEvents(owner: RequestContext, sessionId: string | undefined, response: ServerResponse, fallback: string): Promise<void> {
  const { gateway, http, responses } = owner;
  const ctx: StreamContext = { gateway, http, responses, sessionId, response, unsubscribe: undefined, ended: false, heartbeat: undefined };
  try {
    if (sessionId === undefined) await subscribeWorkbench(ctx);
    else await subscribeSession(ctx);
    if (!response.headersSent) throw new HttpError(503, sessionId === undefined
      ? "Gateway did not publish a workbench snapshot; collection observation was not started."
      : "Gateway did not publish a session snapshot; observation was not started.");
  } catch (error: unknown) {
    if (response.headersSent) throw error;
    refuseStream(ctx, gatewayFailure(error, fallback));
    return;
  }
  ctx.heartbeat = setInterval(() => {
    if (ctx.response.destroyed) return;
    if (ctx.response.writableLength > ctx.http.outputBytes || !ctx.response.write(": keepalive\n\n")) {
      if (ctx.sessionId === undefined || ctx.response.writableLength > ctx.http.outputBytes) ctx.response.destroy();
    }
  }, ctx.http.heartbeatMs);
  ctx.heartbeat.unref();
  response.once("close", () => cleanupStream(ctx));
  if (response.destroyed) cleanupStream(ctx);
}
