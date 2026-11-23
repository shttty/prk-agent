import type { ClientContext } from "../client-state.ts";

export async function closeClient(ctx: ClientContext): Promise<void> {
      if (ctx.closed) return;
      ctx.closed = true;
      ctx.reachable = false;
      for (const client of [...ctx.streams]) {
        ctx.streams.delete(client);
        client.disconnect();
      }
      ctx.control?.disconnect();
      ctx.control = undefined;
      // Pending control and observation connections are guarded at their
      // completion boundaries. Gateway-owned sessions and kernels are
      // untouched by a web shutdown.
    }
