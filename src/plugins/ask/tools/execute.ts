import type { AskEnvironment, AskParameters } from "./ask-types.ts";
import { normalizeQuestions } from "./normalize-questions.ts";
import { formatAskResult } from "./format-result.ts";
export async function execute(env: AskEnvironment, _id: string, params: AskParameters, signal?: AbortSignal) {
      const questions = normalizeQuestions(params.questions);
      const ui = env.ui();
      if (!ui) throw new Error("The session UI is not ready to ask.");
      const outcome = await ui.ask(questions, { signal, timeoutMs: env.timeoutMs });
      return formatAskResult(questions, outcome);
}
