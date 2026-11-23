import type { HostContext } from "../host-types.ts";
import { injectDiscardNotice } from "../inbox/inject-discard-notice.ts";

export function invoke(ctx: HostContext, queued: boolean, dispatch: () => Promise<unknown>): Promise<unknown> {
  return !queued && ctx.discarded.size ? injectDiscardNotice(ctx).then(dispatch) : dispatch();
}
