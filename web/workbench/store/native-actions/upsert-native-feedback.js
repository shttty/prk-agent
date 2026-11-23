import { safeText } from "../../payloads/safe-text.js";
import { nativeFeedbackForSession } from "./native-feedback-for-session.js";
import { patchSession } from "../updates/patch-session.js";
export function upsertNativeFeedback(ctx, feedback) {
    const id = safeText(feedback?.requestId);
    if (!id) return;
    const sessionId = ctx.state.selectedSessionId;
    const scoped = { ...feedback, sessionId };
    const next = nativeFeedbackForSession(ctx, ctx.state.session.nativeFeedback);
    const index = next.findIndex((entry) => entry.requestId === id);
    if (index >= 0) next[index] = scoped;
    else next.push(scoped);
    patchSession(ctx, { nativeFeedback: next.slice(-128), transcriptRevision: ctx.state.session.transcriptRevision + 1 });
  }

