import type { ClientContext } from "../client-state.ts";
import type { GatewayClient } from "../../../gateway/socket-client/client-types.ts";
import { closedError } from "../closed-error.ts";
import { connectGateway } from "../../../gateway/socket-client/connect-client.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { unavailable } from "../connection-errors.ts";

export async function ensureControl(ctx: ClientContext): Promise<GatewayClient> {
    if (ctx.closed) throw closedError();
    if (ctx.control && !ctx.control.lost) return ctx.control;
    ctx.control = undefined;
    // Reconnecting the control channel is safe; in-flight requests are never
    // replayed, they fail with an explicitly unknown outcome. A connection
    // that finishes after close is immediately disconnected instead of being
    // retained as an unowned control socket.
    if (!ctx.connecting) {
      const attempt = connectGateway(ctx.options.socket, ctx.gateway, ctx.limits);
      const guarded = attempt.then((client) => {
        if (ctx.closed) {
          client.disconnect();
          throw closedError();
        }
        ctx.control = client;
        ctx.reachable = true;
        void client.closed.then(() => {
          if (ctx.control !== client) return;
          ctx.control = undefined;
          ctx.reachable = false;
        });
        return client;
      }, (error: unknown) => {
        if (ctx.closed) throw closedError();
        ctx.reachable = false;
        throw error instanceof WireError ? error : unavailable();
      });
      ctx.connecting = guarded;
      void guarded.then(
        () => { if (ctx.connecting === guarded) ctx.connecting = undefined; },
        () => { if (ctx.connecting === guarded) ctx.connecting = undefined; },
      );
    }
    return ctx.connecting;
  }
