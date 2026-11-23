import type { ClientContext } from "./client-state.ts";
import type { WebObserverSink } from "./client-types.ts";
import type { GatewayClient } from "../../gateway/socket-client/client-types.ts";
import { closedError } from "./closed-error.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import { connectGateway } from "../../gateway/socket-client/connect-client.ts";
import { unavailable } from "./connection-errors.ts";

export async function acquireStream(ctx: ClientContext, sink?: WebObserverSink): Promise<GatewayClient> {
    if (ctx.closed) throw closedError();
    if (ctx.streams.size + ctx.pendingStreams >= ctx.maxStreams) {
      throw new WireError("BUSY", "Too many live streams on this web service; close one before opening another.");
    }
    const connection = connectGateway(ctx.options.socket, ctx.gateway, ctx.limits);
    ctx.pendingStreams++;
    let client: GatewayClient;
    try {
      client = await connection;
    } catch (error: unknown) {
      ctx.reachable = false;
      throw error instanceof WireError ? error : unavailable();
    } finally {
      ctx.pendingStreams--;
    }
    // Check shutdown at the connection completion boundary before retaining
    // the stream; the underlying socket attempt cannot be cancelled.
    if (ctx.closed) {
      client.disconnect();
      sink?.end("Web gateway client is closed.");
      throw closedError();
    }
    ctx.streams.add(client);
    return client;
  }
