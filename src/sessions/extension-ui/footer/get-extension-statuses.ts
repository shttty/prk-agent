import type { UiContext } from "../ui-types.ts";

export function getExtensionStatuses(ctx: UiContext) { return ctx.state.status; }
