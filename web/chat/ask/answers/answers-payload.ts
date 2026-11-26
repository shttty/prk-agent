import type { AskQuestion, Draft, TextEntry } from "../ask-types.ts";
import { blankDraft } from "./blank-draft.ts";
import { effectiveAnswer } from "./effective-answer.ts";
/** `answers` for `dialog {id, answers}`, one per question in order. */
export function answersPayload(questions: readonly AskQuestion[], drafts: Record<string, Draft>) {
  return questions.map((question) => {
    const answer = effectiveAnswer(question, drafts[question.id] ?? blankDraft());
    const field = (value: TextEntry) => ({ text: value.text });
    return { id: question.id, selected: answer.selected, ...(answer.custom ? { custom: field(answer.custom) } : {}), ...(answer.note ? { note: field(answer.note) } : {}) };
  });
}
