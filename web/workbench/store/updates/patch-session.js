import { patch } from "./patch.js";
export function patchSession(ctx, changes, options) {
    patch(ctx, { session: { ...ctx.state.session, ...changes } }, options);
  }

