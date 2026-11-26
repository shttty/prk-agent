import type { PatchOptions, StoreContext } from "../store-context-types.ts";
import type { WorkbenchState } from "../store-types.ts";
import { queueDisplayNotify } from "./queue-display-notify.ts";
import { flushDisplayNotify } from "./flush-display-notify.ts";
import { notifyListeners } from "./notify-listeners.ts";
import { extensionUiAction } from "../extension-ui/extension-ui-action.ts";

export function patch(ctx: StoreContext, changes: Partial<WorkbenchState>, { displayOnly = false }: PatchOptions = {}) {
  if (ctx.disposed) return;
  const draftChanged = Object.hasOwn(changes, "draft") && changes.draft !== ctx.state.draft;
  if (draftChanged) ++ctx.draftRevision;
  ctx.state = { ...ctx.state, ...changes };
  if (displayOnly) queueDisplayNotify(ctx);
  else { flushDisplayNotify(ctx); notifyListeners(ctx); }
  if (draftChanged && ctx.state.session.extensionUi && ctx.state.session.extensionUi.editor.text !== ctx.state.draft) void extensionUiAction(ctx, "editor", { text: ctx.state.draft });
}
