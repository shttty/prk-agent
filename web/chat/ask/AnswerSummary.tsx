import type { AskQuestion, EffectiveAnswer } from "./ask-types.ts";

/** What a question's answer reads like in the review list. */
export function AnswerSummary({ question, answer }: { question: AskQuestion; answer: EffectiveAnswer }) {
  const labels = answer.selected.map((index) => question.options[index]?.label);
  return <>
    <span className="pi-ask-review-answer">{[labels.join("、"), answer.custom?.text.trim() ? `“${answer.custom.text.trim()}”` : ""].filter(Boolean).join(" + ")}</span>
    {answer.note?.text.trim() ? <span className="pi-ask-review-note">备注：{answer.note.text.trim()}</span> : null}
  </>;
}
