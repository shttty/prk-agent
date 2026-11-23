import type { ClientContext } from "./client-state.ts";
import type { HostEventListener, CollectionEventListener, TerminalEventListener } from "./client-types.ts";
import type { Method, RecoveryMode } from "../wire/wire-types.ts";
import { readConnectionStatus } from "./connection/read-connection-status.ts";
import { subscribeHostEvents } from "./subscription/subscribe-host-events.ts";
import { subscribeCollectionEvents } from "./subscription/subscribe-collection-events.ts";
import { subscribeTerminalEvents } from "./subscription/subscribe-terminal-events.ts";
import { recoverSession } from "./protocol/recover-session.ts";
import { sendRequest } from "./protocol/send-request.ts";

export function assembleClient(ctx: ClientContext, lose: () => void) {
  return {
    closed: ctx.closed.promise,
    get lost() { return readConnectionStatus(ctx); },
    onEvent(listener: HostEventListener) { return subscribeHostEvents(ctx, listener); },
    onCollectionEvent(listener: CollectionEventListener) { return subscribeCollectionEvents(ctx, listener); },
    onTerminalEvent(listener: TerminalEventListener) { return subscribeTerminalEvents(ctx, listener); },
    recoverSession(sessionId: string, mode: RecoveryMode): Promise<unknown> {
      return recoverSession(this, sessionId, mode);
    },
    request(method: Method, params: Record<string, unknown> = {}, requestTimeoutMs = ctx.gateway.requestTimeoutMs): Promise<unknown> {
      return sendRequest(ctx, lose, method, params, requestTimeoutMs);
    },
    disconnect: lose,
  };
}
