import type { UiContext } from "../ui-types.ts";
import { publish } from "../publication/publish-revision.ts";

export function finishDialog(ctx: UiContext, id: string, value: unknown): void {
    const dialog = ctx.dialogs.get(id);
    if (!dialog) return;
    clearTimeout(dialog.timer);
    if (dialog.abort) dialog.abort.removeEventListener("abort", dialog.onAbort);
    ctx.dialogs.delete(id);
    dialog.resolve(value);
    publish(ctx);
  }
