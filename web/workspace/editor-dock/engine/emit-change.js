import { serializeLayout } from "../../editor-layout/serialize-layout.js";
export const emitChange = (ctx) => {
    const json = ctx.api.panels.length ? serializeLayout(ctx.api.toJSON()) : null;
    for (const listener of [...ctx.changeListeners]) listener(json);
  };
