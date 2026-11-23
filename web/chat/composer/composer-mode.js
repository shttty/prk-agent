import { likelyPlainText } from "./likely-plain-text.js";
import { hasComposerDraft } from "./has-composer-draft.js";
export function composerMode(ctx) {
  const { normalizedComposerText, candidateOptions, activeCommand, composerText, plainSendAvailable, queue, attachments = [] } = ctx;
  const unknownControl = normalizedComposerText.startsWith("/") && !activeCommand && candidateOptions.length === 0 && /^\/\S+/.test(normalizedComposerText);
  const plainSuggested = likelyPlainText(composerText) || unknownControl || plainSendAvailable === true;
  const queueMode = queue === "followUp" ? "followUp" : "steer";
  const otherQueue = queueMode === "steer" ? "followUp" : "steer";
  const hasDraft = hasComposerDraft(composerText, attachments);
  return { unknownControl, plainSuggested, queueMode, otherQueue, hasDraft };
}

