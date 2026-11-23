import { applyToolLoadout } from "../tools/apply-loadout.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function refreshCapabilities(ctx: RuntimeContext): void { applyToolLoadout(ctx, ctx.active.session); }
