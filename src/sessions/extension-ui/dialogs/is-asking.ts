import type { UiContext } from "../ui-types.ts";

export function asking(ctx: UiContext): boolean { return [...ctx.dialogs.values()].some((dialog) => dialog.ask !== undefined); }
