import { capabilityCatalog } from "./get-catalog.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function getRequiresReload(ctx: RuntimeContext): boolean { return capabilityCatalog(ctx).requiresReload; }
