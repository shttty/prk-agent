import type { ClientContext } from "./client-state.ts";
import type { GatewayClient } from "../../gateway/socket-client/client-types.ts";
import { acquireStream } from "./acquire-stream.ts";

export async function withFileTransfer(ctx: ClientContext, signal: AbortSignal, work: (client: GatewayClient) => Promise<void>): Promise<void> {
  signal.throwIfAborted();
  const client = await acquireStream(ctx);
  const close = () => { ctx.streams.delete(client); client.disconnect(); };
  signal.addEventListener("abort", close, { once: true });
  try {
    signal.throwIfAborted();
    await work(client);
  } finally {
    signal.removeEventListener("abort", close);
    close();
  }
}
