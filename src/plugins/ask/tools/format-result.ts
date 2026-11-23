import type { TextContent } from "@earendil-works/pi-ai";
import type { AskQuestion, AskOutcome } from "./ask-types.ts";
/** Text for the model (one `id: answer` line per question) and the plain-data `details` the web shows from history. */
export function formatAskResult(questions: readonly AskQuestion[], outcome: AskOutcome | undefined): { content: TextContent[]; details: unknown } {
  if (!outcome) return { content: [{ type: "text", text: "User cancelled the questions without answering." }], details: { outcome: "cancelled" } };
  if (outcome.kind === "chat") {
    return {
      content: [{ type: "text", text: `User chose to chat about this instead of answering.\n\nQuestions asked:\n${questions.map((question) => question.question).join("\n")}` }],
      details: { outcome: "chat" },
    };
  }
  const lines = outcome.answers.map((answer, index) => {
    const multi = questions[index]?.multi === true;
    const parts: string[] = [];
    if (answer.selected.length > 0) parts.push(multi ? `[${answer.selected.join(", ")}]` : answer.selected[0]!);
    if (answer.custom) parts.push(`"${answer.custom}"`);
    const value = parts.length > 0 ? parts.join(" + ") : multi ? "[]" : "(no answer)";
    const note = answer.note ? ` (note: ${answer.note})` : "";
    return `${answer.id}: ${value}${answer.autoSelected ? " (auto-selected after timeout)" : ""}${note}`;
  });
  return {
    content: [{ type: "text", text: `User answers:\n${lines.join("\n")}` }],
    details: {
      outcome: "answers",
      answers: outcome.answers.map((answer) => ({
        id: answer.id,
        selected: answer.selected,
        ...(answer.custom ? { custom: answer.custom } : {}),
        ...(answer.note ? { note: answer.note } : {}),
        ...(answer.autoSelected ? { autoSelected: true } : {}),
      })),
    },
  };
}
