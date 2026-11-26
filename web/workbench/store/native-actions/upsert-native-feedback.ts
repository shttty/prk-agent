import type { StoreContext } from "../store-context-types.ts";
import type { NativeFeedback } from "../store-types.ts";
import { nativeFeedbackForSession } from "./native-feedback-for-session.ts";
import { patchSession } from "../updates/patch-session.ts";

export function upsertNativeFeedback(ctx: StoreContext, feedback: NativeFeedback) {
  if (!feedback.requestId) return;
  const scoped = { ...feedback, sessionId: ctx.state.selectedSessionId };
  const next = nativeFeedbackForSession(ctx, ctx.state.session.nativeFeedback);
  const index = next.findIndex((entry) => entry.requestId === feedback.requestId);
  if (index >= 0) next[index] = scoped;
  else next.push(scoped);
  patchSession(ctx, { nativeFeedback: next.slice(-128), transcriptRevision: ctx.state.session.transcriptRevision + 1 });
}
