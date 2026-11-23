import { FILE_COMPONENT } from "../../editor-layout/editor-layout-constants.js";
export function listen(ctx) {
      ctx.subscriptions.push(
        ctx.api.onDidLayoutChange(ctx.emitChange),
        ctx.api.onDidActivePanelChange(() => { for (const listener of [...ctx.activeListeners]) listener(ctx.activePath()); ctx.emitChange(); }),
        ctx.api.onDidRemovePanel((panel) => { if (panel.api.component === FILE_COMPONENT) for (const listener of [...ctx.removedListeners]) listener(panel.params?.path); }),
      );
    }
