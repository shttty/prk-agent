import type { StoreContext } from "../store-context-types.ts";
import type { WorkbenchState } from "../store-types.ts";
import { patch } from "../updates/patch.ts";

export function setQueue(ctx: StoreContext, mode: WorkbenchState["queue"]) { patch(ctx, { queue: mode }); }
