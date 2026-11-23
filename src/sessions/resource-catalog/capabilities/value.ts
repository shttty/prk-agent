import type { CapabilityProjectionContext } from "../catalog-types.ts";
import { LOCAL_TOOLS_GROUP } from "../catalog-constants.ts";

export const value = (ctx: CapabilityProjectionContext, id: string) => id === LOCAL_TOOLS_GROUP ? ctx.localOverride ?? (ctx.local && ctx.defaults.localTools) : ctx.overrides[id] ?? ctx.defaults.capabilities[id] ?? true;
