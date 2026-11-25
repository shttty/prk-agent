import type { HostContext } from "../host-types.ts";
import type { UserWait } from "../../extension-ui/ui-types.ts";

export type SessionAttention = UserWait & { readonly stopped?: true; readonly retryPending?: true };

export function readAttention(ctx: HostContext): SessionAttention {
  if (ctx.closing) return {};
  return {
    ...ctx.options.extensionUi?.userWait(),
    ...(ctx.retryGrace ? { retryPending: true } : ctx.stopped ? { stopped: true } : {}),
  };
}
