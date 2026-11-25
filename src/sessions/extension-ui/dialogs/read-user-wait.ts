import type { UserWait, UiContext } from "../ui-types.ts";

export function readUserWait(ctx: UiContext): UserWait {
  const asking = [...ctx.dialogs.values()].some((dialog) => dialog.kind === "ask");
  const waiting = ctx.dialogs.size + Number(ctx.custom?.component !== undefined && ctx.custom.options?.blocked !== undefined);
  return { ...(asking ? { asking: true } : {}), ...(waiting > 0 ? { blocked: true } : {}) };
}
