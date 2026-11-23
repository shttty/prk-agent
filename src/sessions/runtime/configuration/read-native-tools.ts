import { defaults } from "./read-defaults.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function localEnabled(ctx: RuntimeContext) { return ctx.localOverride ?? (ctx.target.local === true && defaults(ctx).localTools); }
