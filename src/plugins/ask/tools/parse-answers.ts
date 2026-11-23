import type { AskQuestion, AskAnswer } from "./ask-types.ts";
import { record } from "./answer-record.ts";
import { wireText } from "./wire-text.ts";
/**
 * The one place a browser's answers are checked: one entry per question, in order, selecting existing options
 * (index), with an optional free-text "other" answer or note. Everything past this returns typed values.
 */
export function parseAskAnswers(questions: readonly AskQuestion[], raw: unknown): { readonly answers: AskAnswer[] } | { readonly error: string } {
  if (!Array.isArray(raw) || raw.length !== questions.length) return { error: "Answers must cover every question, in order." };
  const answers: AskAnswer[] = [];
  for (const [index, question] of questions.entries()) {
    const entry: unknown = raw[index];
    if (!record(entry) || entry.id !== question.id) return { error: "Answers must cover every question, in order." };
    const selected = entry.selected ?? [];
    if (!Array.isArray(selected) || !selected.every((item) => Number.isInteger(item) && item >= 0 && item < question.options.length) || new Set(selected).size !== selected.length) return { error: "Selection is not valid." };
    if (!question.multi && selected.length > 1) return { error: "Selection is not valid." };
    const custom = entry.custom === undefined ? undefined : wireText(entry.custom);
    const note = entry.note === undefined ? undefined : wireText(entry.note);
    if (custom && "error" in custom) return { error: custom.error };
    if (note && "error" in note) return { error: note.error };
    if (custom && !question.multi && selected.length > 0) return { error: "A custom answer replaces the selection." };
    if (note && !custom && selected.length === 0) return { error: "A note needs an answer." };
    answers.push({ id: question.id, selected: [...selected].sort((a, b) => a - b).map((option) => question.options[option]!.label), ...(custom ? { custom: custom.text } : {}), ...(note ? { note: note.text } : {}) });
  }
  return { answers };
}
