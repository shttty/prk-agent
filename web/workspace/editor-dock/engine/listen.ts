import type { EngineContext } from "./engine-types.ts";
import { FILE_COMPONENT } from "../../editor-layout/editor-layout-constants.ts";
import { paramString } from "./param-string.ts";

export function listen(ctx: EngineContext) {
  ctx.subscriptions.push(
    ctx.api.onDidLayoutChange(ctx.emitChange),
    ctx.api.onDidActivePanelChange(() => { for (const listener of [...ctx.activeListeners]) listener(ctx.activePath()); ctx.emitChange(); }),
    ctx.api.onDidRemovePanel((panel) => { if (panel.api.component === FILE_COMPONENT) for (const listener of [...ctx.removedListeners]) listener(paramString(panel.params, "path")); }),
  );
}
