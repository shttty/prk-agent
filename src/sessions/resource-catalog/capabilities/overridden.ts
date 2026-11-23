import type { CapabilityProjectionContext } from "../catalog-types.ts";
import { LOCAL_TOOLS_GROUP } from "../catalog-constants.ts";

export const overridden = (ctx: CapabilityProjectionContext, id: string) => id === LOCAL_TOOLS_GROUP ? ctx.localOverride !== undefined : Object.hasOwn(ctx.overrides, id);
