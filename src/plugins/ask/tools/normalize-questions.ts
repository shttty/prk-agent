import type { AskOption, AskQuestion } from "./ask-types.ts";
import { RESERVED_LABELS } from "./question-constants.ts";
import { reservedKey } from "./reserved-key.ts";
/** Drop blank optional strings and an out-of-range `recommended`, and refuse what the UI could not show unambiguously. */
export function normalizeQuestions(questions: readonly { id: string; question: string; header?: string; options: readonly AskOption[]; multi?: boolean; recommended?: number }[]): AskQuestion[] {
  const ids = new Set<string>();
  return questions.map((question) => {
    if (ids.has(question.id)) throw new Error(`Question ids must be unique: ${JSON.stringify(question.id)}.`);
    ids.add(question.id);
    const labels = new Set<string>();
    for (const option of question.options) {
      if (RESERVED_LABELS[reservedKey(option.label)] === true) throw new Error(`Option labels must not collide with the reserved rows the UI adds itself: ${JSON.stringify(option.label)}. Do not supply an "Other" option.`);
      if (labels.has(option.label)) throw new Error(`Option labels must be unique within a question: ${JSON.stringify(option.label)}.`);
      labels.add(option.label);
    }
    const header = question.header?.trim();
    return {
      id: question.id,
      question: question.question,
      ...(header ? { header } : {}),
      options: question.options.map((option) => ({
        label: option.label,
        ...(option.description?.trim() ? { description: option.description.trim() } : {}),
        ...(option.preview?.trim() ? { preview: option.preview } : {}),
      })),
      ...(question.multi === undefined ? {} : { multi: question.multi }),
      ...(question.recommended !== undefined && question.recommended < question.options.length ? { recommended: question.recommended } : {}),
    };
  });
}
