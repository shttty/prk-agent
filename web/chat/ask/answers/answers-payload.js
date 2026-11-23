import { effectiveAnswer } from "./effective-answer.js";
/** `answers` for `dialog {id, answers}`, one per question in order. */
export function answersPayload(questions, drafts) {
  return questions.map((question) => {
    const answer = effectiveAnswer(question, drafts[question.id]);
    const field = (value) => ({ text: value.text });
    return { id: question.id, selected: answer.selected, ...(answer.custom ? { custom: field(answer.custom) } : {}), ...(answer.note ? { note: field(answer.note) } : {}) };
  });
}
