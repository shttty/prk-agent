import type { StoreContext } from "../store-context-types.ts";
import { sessionPhase } from "./session-phase.ts";
import { postJson } from "./post-json.ts";
import { phaseChanged } from "./phase-changed.ts";
import { RequestError } from "./request-error.ts";
import { subscribe } from "../updates/subscribe.ts";

/** POST under `apiRoot`; a transient `BUSY` answer for a session waits for that session's state to change, then retries. */
export async function postSettled(ctx: StoreContext, path: string, payload: unknown = {}): Promise<unknown> {
  const name = /^\/sessions\/([^/]+)\//.exec(path)?.[1];
  const sessionRow = name ? decodeURIComponent(name) : null;
  for (;;) {
    const phase = sessionRow ? sessionPhase(ctx, sessionRow) : null;
    try { return await postJson(`${ctx.apiRoot}${path}`, payload); }
    catch (error) {
      if (!sessionRow || !phase || !(error instanceof RequestError) || error.code !== "BUSY" || error.details?.transient !== true) throw error;
      if (phaseChanged(ctx, sessionRow, phase)) continue;
      await new Promise<void>((resolve) => {
        const stop = subscribe(ctx, () => { if (phaseChanged(ctx, sessionRow, phase)) { stop(); resolve(); } });
      });
    }
  }
}
