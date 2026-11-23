import type { AskQuestion, AskAnswer } from "./ask-types.ts";
/** What a timed-out dialog answers: each question's recommended option, else its first (none for a question without options). */
export function autoSelectAnswers(questions: readonly AskQuestion[]): AskAnswer[] {
  return questions.map((question) => {
    const option = question.options[question.recommended ?? 0];
    return { id: question.id, selected: option ? [option.label] : [], autoSelected: true };
  });
}
