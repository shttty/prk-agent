import type { HostContext } from "../host-types.ts";
import type { UserWait } from "../../extension-ui/ui-types.ts";

export type SessionAttention = UserWait & { readonly stopped?: true; readonly retryPending?: true; readonly background?: true };

export function readAttention(ctx: HostContext): SessionAttention {
  if (ctx.closing) return {};
  const background = (ctx.kernel?.getSnapshot().activeCells.length ?? 0) > 0
    || ctx.options.terminals?.getSnapshot().some((terminal) => terminal.owner === "model" && Boolean(terminal.runningCommand));
  return {
    ...(background ? { background: true } : {}),
    ...ctx.options.extensionUi?.userWait(),
    ...(ctx.retryGrace ? { retryPending: true } : ctx.stopped ? { stopped: true } : {}),
  };
}
