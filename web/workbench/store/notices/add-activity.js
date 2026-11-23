import { patchSession } from "../updates/patch-session.js";
import { MAX_ACTIVITY } from "../store-constants.js";
export function addActivity(ctx, activity) {
    const entry = {
      ...activity,
      id: `${Date.now()}-${ctx.state.session.activities.length}`,
    };
    patchSession(ctx, { activities: [...ctx.state.session.activities, entry].slice(-MAX_ACTIVITY) });
  }

