import type { AskQuestion, Draft, EffectiveAnswer } from "../ask-types.ts";
import { filled } from "./filled.ts";
/** The answer a draft amounts to: the single-select exclusivity applied, and a note kept only while its option is selected. */
export function effectiveAnswer(question: AskQuestion, draft: Draft): EffectiveAnswer {
  const customFilled = filled(draft.custom);
  const custom = customFilled && (question.multi === true || draft.selected.length === 0 || draft.pick === "other") ? draft.custom : null;
  const selected = question.multi === true ? [...draft.selected].sort((a, b) => a - b) : custom ? [] : draft.selected.slice(0, 1);
  const note = filled(draft.note) && draft.note.row !== null && selected.includes(draft.note.row) ? draft.note : null;
  return { selected, custom, note };
}
