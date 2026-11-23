import { queueDisplayNotify } from "./queue-display-notify.js";
import { flushDisplayNotify } from "./flush-display-notify.js";
import { notifyListeners } from "./notify-listeners.js";
import { extensionUiAction } from "../extension-ui/extension-ui-action.js";
export function patch(ctx, changes, { displayOnly = false } = {}) {
    if (ctx.disposed) return;
    const draftChanged = Object.hasOwn(changes, "draft") && changes.draft !== ctx.state.draft;
    if (draftChanged) ++ctx.draftRevision;
    ctx.state = { ...ctx.state, ...changes };
    if (displayOnly) queueDisplayNotify(ctx);
    else { flushDisplayNotify(ctx); notifyListeners(ctx); }
    if (draftChanged && ctx.state.session.extensionUi && ctx.state.session.extensionUi.editor?.text !== ctx.state.draft) void extensionUiAction(ctx, "editor", { text: ctx.state.draft });
  }

