import { likelyPlainText } from "./likely-plain-text.ts";
import { hasComposerDraft } from "./has-composer-draft.ts";
import type { ComposerCommand, QueueMode } from "./composer-types.ts";

type ComposerModeInput = { normalizedComposerText: string; candidateOptions: readonly ComposerCommand[]; activeCommand: ComposerCommand | null; composerText: string; plainSendAvailable: boolean; queue: string; attachments: readonly unknown[] };

export function composerMode({ normalizedComposerText, candidateOptions, activeCommand, composerText, plainSendAvailable, queue, attachments }: ComposerModeInput) {
  const unknownControl = normalizedComposerText.startsWith("/") && !activeCommand && candidateOptions.length === 0 && /^\/\S+/.test(normalizedComposerText);
  const plainSuggested = likelyPlainText(composerText) || unknownControl || plainSendAvailable;
  const queueMode: QueueMode = queue === "followUp" ? "followUp" : "steer";
  const otherQueue: QueueMode = queueMode === "steer" ? "followUp" : "steer";
  const hasDraft = hasComposerDraft(composerText, attachments);
  return { unknownControl, plainSuggested, queueMode, otherQueue, hasDraft };
}
