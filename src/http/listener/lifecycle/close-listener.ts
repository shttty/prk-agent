import type { ListenerContext } from "../listener-state.ts";

export async function closeListener(ctx: ListenerContext): Promise<void> {
    if (ctx.closing) return ctx.closing;
    ctx.stopping = true;
    ctx.closing = (async () => {
      const listenerClosed = new Promise<void>((resolve, reject) => {
        ctx.server.close((error) => error ? reject(error) : resolve());
      });
   void listenerClosed.catch(() => { });
      for (const response of ctx.responses) response.end();
      ctx.terminalSockets!.close();
      ctx.server.closeAllConnections();
      try {
        await listenerClosed;
      } catch (error: unknown) {
        throw new AggregateError([error], "Web listener shutdown failed; Gateway-owned sessions were not affected.");
      }
      // Deliberately no session cleanup here: the Gateway owns those sessions
      // and kernels, and a web restart must preserve them.
    })();
    void ctx.closing.then(ctx.done.resolve, ctx.done.reject);
    return ctx.closing;
  }