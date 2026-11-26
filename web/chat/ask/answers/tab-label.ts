import type { AskQuestion } from "../ask-types.ts";

const truncate = (text: string, length: number) => (text.length > length ? `${text.slice(0, length)}…` : text);

/** Tab label: the question's `header`, else its text cut short. */
export function tabLabel(question: AskQuestion, index: number): string {
  return question.header?.trim() || truncate(question.question.trim().replace(/\s+/g, " "), 12) || `Q${index + 1}`;
}
