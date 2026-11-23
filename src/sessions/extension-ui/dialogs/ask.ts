import type { UiContext, HostedExtensionUI } from "../ui-types.ts";
import { createDialog } from "./create-dialog.ts";
import { onAskTimeout } from "./on-timeout.ts";
import { type AskOutcome } from "../../../plugins/ask/tools/ask-types.ts";
import { askCellScope } from "../../../kernel/callback/ask-cell-scope.ts";

export function ask(ctx: UiContext, questions: Parameters<HostedExtensionUI["ask"]>[0], options: Parameters<HostedExtensionUI["ask"]>[1]) {
  return createDialog<AskOutcome>(ctx, "ask", "", { ask: { questions, ...askCellScope.getStore() } }, {
    ...(options.signal ? { signal: options.signal } : {}),
    timeout: options.timeoutMs,
    onTimeout: () => onAskTimeout(ctx, questions),
  }); }
