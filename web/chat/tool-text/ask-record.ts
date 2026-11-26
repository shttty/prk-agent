import { isPayload } from "../payload/is-payload.ts";
import type { Payload } from "../payload/is-payload.ts";
import { asText } from "./as-text.ts";

export type AskRow = { id: string; label: string; question: string; answer: { selected: string[]; custom: string; note: string; auto: boolean; answered: boolean } | null };
type AskOutcome = "waiting" | "answers" | "chat" | "cancelled" | "unknown";

/**
 * What an `ask` call asked and what the user answered, from the call's arguments and the result's structured `details`
 * (src/sessions/ask.ts formatAskResult): `outcome` is waiting (no result yet), answers, chat, cancelled or unknown
 * (a result without that record, e.g. an error); each row carries its question and, for `answers`, the answer.
 */
export function askRecord(args: Payload | null | undefined, result: Payload | undefined): { outcome: AskOutcome; rows: AskRow[] } {
  const details = isPayload(result?.details) ? result.details : null;
  const recorded = details?.outcome;
  const outcome: AskOutcome = result === undefined ? "waiting" : recorded === "answers" || recorded === "chat" || recorded === "cancelled" ? recorded : "unknown";
  const answers = new Map((outcome === "answers" && Array.isArray(details?.answers) ? details.answers : []).filter(isPayload).map((answer) => [asText(answer.id), answer]));
  const rows = (Array.isArray(args?.questions) ? args.questions : []).filter(isPayload).map((question) => {
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
