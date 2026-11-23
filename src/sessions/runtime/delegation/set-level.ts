import type { DelegationLevel } from "../../../config/session/delegation-levels.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function setDelegation(ctx: RuntimeContext, level: DelegationLevel): void {
  ctx.delegation = level;
  ctx.sessionManager.appendCustomEntry("gateway-native-session-state", { version: 1, delegation: level });
}
