import type { ClientContext } from "../client-state.ts";
import { connectGateway } from "../../../gateway/socket-client/connect-client.ts";

export async function openInitialControl(ctx: ClientContext): Promise<void> {
  // Fail fast at startup: an unreachable Gateway must not produce a web
  // listener that looks healthy.
  const initial = await connectGateway(ctx.options.socket, ctx.gateway, ctx.limits);
  ctx.control = initial;
  void initial.closed.then(() => {
    if (ctx.control !== initial) return;
    ctx.control = undefined;
    ctx.reachable = false;
  });
}
