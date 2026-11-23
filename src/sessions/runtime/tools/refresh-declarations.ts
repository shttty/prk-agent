import type { RuntimeContext } from "../runtime-state.ts";
import { applyToolLoadout } from "./apply-loadout.ts";

export function refreshToolDeclarations(ctx: RuntimeContext): void {
  applyToolLoadout(ctx, ctx.active.session, false);
}
