import type { EngineContext } from "./engine-types.ts";
import { paramString } from "./param-string.ts";

export const panelsOf = (ctx: EngineContext, component: string) => ctx.api.panels.filter((panel) => panel.api.component === component).flatMap((panel) => {
  const path = paramString(panel.params, "path");
  return path === null ? [] : [{ id: panel.id, path }];
});
