import type { UiContext } from "../ui-types.ts";
import { type AskQuestion, type AskOutcome } from "../../../plugins/ask/tools/ask-types.ts";
import { autoSelectAnswers } from "../../../plugins/ask/tools/select-timeout-answers.ts";

export function onAskTimeout(ctx: UiContext, questions: readonly AskQuestion[]): AskOutcome { return { kind: "answers", answers: autoSelectAnswers(questions) }; }
