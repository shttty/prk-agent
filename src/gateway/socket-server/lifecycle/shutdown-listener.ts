import type { ListenerContext } from "../listener-state.ts";
import { endSocket } from "../../socket-channel/end-socket.ts";

export function shutdownListener(ctx: ListenerContext, success?: () => void, failed?: (error: unknown) => void): Promise<void> {
  const { server, host, peers, gateway, done } = ctx;
  if (ctx.shutdownTask) return ctx.shutdownTask;
  ctx.stopping = true;
  ctx.shutdownTask = (async () => {
    const errors: unknown[] = [];
    const listenerClosed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
 void listenerClosed.catch(() => { });
    try { await host.close(); success?.(); }
    catch (error) { errors.push(error); failed?.(error); }
    for (const peer of peers) endSocket(peer, gateway.socketCloseGraceMs);
    try { await listenerClosed; } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(errors, "Gateway shutdown failed; inspect owned resources.");
  })();
  void ctx.shutdownTask.then(done.resolve, done.reject);
  return ctx.shutdownTask;
}
