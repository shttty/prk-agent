import type { UiContext } from "../ui-types.ts";
import { publish } from "../publication/publish-revision.ts";
import { finishDialog } from "../dialogs/finish-dialog.ts";

export function cancel(ctx: UiContext, scope?: "operation"): void {
    for (const id of [...ctx.dialogs.keys()]) {
      if (scope === "operation") {
        // Cell asks close on their own callback signal, not on SDK operation stop.
        const ask = ctx.dialogs.get(id)?.ask;
        if (ask?.kernelId !== undefined && ask.cellId !== undefined) continue;
      }
      finishDialog(ctx, id, undefined);
    }
    for (const submenu of [...ctx.settingsSubmenus.values()]) submenu.close();
    if (ctx.custom) { ctx.custom.done(undefined); ctx.custom = undefined; }
    publish(ctx);
  }
