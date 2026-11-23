import type { HostContext } from "../host/host-state.ts";
import { boundedError } from "../../diagnostics/session-errors/truncate-error-detail.ts";
import { describeError } from "../../diagnostics/session-errors/describe-error.ts";

export function startIdleReclamation(ctx: HostContext): void {
  ctx.lifecycle.idleTimer = setInterval(() => {
  void ctx.methods.reclaimIdle().catch((error) => console.error(`[${new Date().toISOString()}] Idle reclamation failed. ${boundedError(describeError(error, ctx.host.config.session), ctx.host.config.session.errorDetailChars)}`));
 }, Math.min(ctx.lifecycle.sessionIdleTimeoutMs, ctx.host.config.session.idleCheckIntervalMs));
}
