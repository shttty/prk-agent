import type { HostContext } from "../host/host-state.ts";

/** Receipt delivery schedules archival after the current SDK run and host operation settle. */
export function finishTemporarySession(ctx: HostContext, sessionId: string): void {
  const host = ctx.methods.sessionHost(sessionId);
  const operation = host.getSnapshot().operation;
  const archive = () => {
    if (ctx.derivation.derivation.isChanging(sessionId) || !ctx.host.history.listAll().some((entry) => entry.sessionId === sessionId)) return;
    void ctx.derivation.derivation.destroySession(sessionId).catch((error) => {
      console.error(`[${new Date().toISOString()}] Delivered temporary session ${sessionId} could not be archived.`, error);
    });
  };
  if (!operation) { archive(); return; }
  const subscription = host.subscribe((event) => {
    if (event.type !== "operation_completed" || event.operationId !== operation.operationId) return;
    subscription.unsubscribe();
    archive();
  });
}
