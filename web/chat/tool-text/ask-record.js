import { asText } from "./as-text.js";
/**
 * What an `ask` call asked and what the user answered, from the call's arguments and the result's structured `details`
 * (src/sessions/ask.ts formatAskResult): `outcome` is waiting (no result yet), answers, chat, cancelled or unknown
 * (a result without that record, e.g. an error); each row carries its question and, for `answers`, the answer.
 */
export function askRecord(args, result) {
  const details = result?.details && typeof result.details === "object" ? result.details : null;
  const outcome = result === undefined ? "waiting" : ["answers", "chat", "cancelled"].includes(details?.outcome) ? details.outcome : "unknown";
  const answers = new Map((outcome === "answers" && Array.isArray(details.answers) ? details.answers : []).map((answer) => [asText(answer?.id), answer]));
  const rows = (Array.isArray(args?.questions) ? args.questions : []).filter((question) => question && typeof question === "object").map((question) => {
    const answer = answers.get(asText(question.id));
    const selected = Array.isArray(answer?.selected) ? answer.selected.map(asText) : [];
    const custom = asText(answer?.custom);
    return {
      id: asText(question.id),
      label: asText(question.header).trim(),
      question: asText(question.question),
      answer: outcome === "answers" ? {
        selected, custom, note: asText(answer?.note), auto: answer?.autoSelected === true,
        answered: selected.length > 0 || custom !== "",
      } : null,
    };
  });
  return { outcome, rows };
}
