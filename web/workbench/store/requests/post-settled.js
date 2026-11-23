import { sessionPhase } from "./session-phase.js";
import { postJson } from "./post-json.js";
import { phaseChanged } from "./phase-changed.js";
import { subscribe } from "../updates/subscribe.js";
export async function postSettled(ctx, path, payload = {}) {
    const name = /^\/sessions\/([^/]+)\//.exec(path)?.[1];
    const sessionRow = name ? decodeURIComponent(name) : null;
    for (;;) {
      const phase = sessionRow ? sessionPhase(ctx, sessionRow) : [];
      try { return await postJson(ctx, `${ctx.apiRoot}${path}`, payload); }
      catch (error) {
        if (!sessionRow || error?.code !== "BUSY" || error.details?.transient !== true) throw error;
        if (phaseChanged(ctx, sessionRow, phase)) continue;
        await new Promise((resolve) => {
          const stop = subscribe(ctx, () => { if (phaseChanged(ctx, sessionRow, phase)) { stop(); resolve(); } });
        });
      }
    }
  }

