import type { Submission, SubmitMessageRequest } from "../../../sessions/host/host-types.ts";
import { requireSource } from "../binding/require-active-source.ts";
import type { HostBindingContext } from "../host-binding-state.ts";

export function submit(ctx: HostBindingContext, request: SubmitMessageRequest): Promise<Submission> {
  return ctx.parent.methods.admitInput(ctx.sessionId, () => requireSource(ctx).submit(request));
}
