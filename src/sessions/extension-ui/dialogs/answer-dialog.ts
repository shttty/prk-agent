import type { UiContext } from "../ui-types.ts";
import { finishDialog } from "./finish-dialog.ts";
import { type AskOutcome } from "../../../plugins/ask/tools/ask-types.ts";
import { parseAskAnswers } from "../../../plugins/ask/tools/parse-answers.ts";

export function answerDialog(ctx: UiContext, args: Record<string, unknown>, id: string): unknown {
      const dialog = ctx.dialogs.get(id);
      if (!dialog) return { status: "unavailable", message: "Dialog is no longer active." };
      if (args.cancel === true) { finishDialog(ctx, dialog.id, undefined); return { status: "cancelled" }; }
      if (dialog.ask) {
        if (args.chat === true) { finishDialog(ctx, dialog.id, { kind: "chat" } satisfies AskOutcome); return { status: "completed" }; }
        const parsed = parseAskAnswers(dialog.ask.questions, args.answers);
        if ("error" in parsed) return { status: "unavailable", message: parsed.error };
        finishDialog(ctx, dialog.id, { kind: "answers", answers: parsed.answers } satisfies AskOutcome); return { status: "completed" };
      }
      if (dialog.kind === "select" && (typeof args.value !== "string" || !dialog.options?.includes(args.value))) return { status: "unavailable", message: "Selection is not valid." };
      if (dialog.kind === "confirm" && typeof args.value !== "boolean") return { status: "unavailable", message: "Confirmation value is invalid." };
      if ((dialog.kind === "input" || dialog.kind === "editor") && typeof args.value !== "string") return { status: "unavailable", message: "Text input is invalid." };
      finishDialog(ctx, dialog.id, args.value); return { status: "completed" };
    
}
