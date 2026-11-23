import type { CapabilityProjectionContext } from "../catalog-types.ts";
import { LOCAL_TOOLS_GROUP } from "../catalog-constants.ts";

export const defaultValue = (ctx: CapabilityProjectionContext, id: string) => id === LOCAL_TOOLS_GROUP ? ctx.local && ctx.defaults.localTools : ctx.defaults.capabilities[id] ?? true;
