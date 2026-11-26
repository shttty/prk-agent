import type { EngineContext } from "./engine-types.ts";
import { serializeLayout } from "../../editor-layout/serialize-layout.ts";

export const emitChange = (ctx: EngineContext) => {
  const json = ctx.api.panels.length ? serializeLayout(ctx.api.toJSON()) : null;
  for (const listener of [...ctx.changeListeners]) listener(json);
};
