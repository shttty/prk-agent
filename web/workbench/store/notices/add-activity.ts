import type { StoreContext } from "../store-context-types.ts";
import type { Activity } from "../store-types.ts";
import { patchSession } from "../updates/patch-session.ts";
import { MAX_ACTIVITY } from "../store-constants.ts";

export function addActivity(ctx: StoreContext, activity: Omit<Activity, "id">) {
  const entry = { ...activity, id: `${Date.now()}-${ctx.state.session.activities.length}` };
  patchSession(ctx, { activities: [...ctx.state.session.activities, entry].slice(-MAX_ACTIVITY) });
}
