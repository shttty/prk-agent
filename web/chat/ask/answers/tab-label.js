
// Pure logic of the ask dialog (no React, so node tests import it): the draft a user builds per question, the answer it
// amounts to, and the wire payload. The Gateway checks the payload once more (src/sessions/ask.ts parseAskAnswers).

export const filled = (field) => Boolean(field.text.trim());

export const truncate = (text, length) => (text.length > length ? `${text.slice(0, length)}…` : text);

/** Tab label: the question's `header`, else its text cut short. */
export function tabLabel(question, index) {
  return question.header?.trim() || truncate(question.question.trim().replace(/\s+/g, " "), 12) || `Q${index + 1}`;
}
