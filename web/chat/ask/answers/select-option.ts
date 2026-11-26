import type { AskQuestion, Draft } from "../ask-types.ts";

/** Select an option: a single-select question takes exactly it, a multi-select one toggles it. */
export function selectOption(question: AskQuestion, draft: Draft, index: number): Draft {
  if (question.multi === true) return { ...draft, selected: draft.selected.includes(index) ? draft.selected.filter((item) => item !== index) : [...draft.selected, index] };
  return { ...draft, selected: [index], pick: "option" };
}
