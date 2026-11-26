import type { WorkbenchState } from "./store-types.ts";
import { initializeStoreContext } from "./initialize-store-context.ts";
import { createWorkbenchActions, type WorkbenchActions } from "./create-workbench-actions.ts";
import { subscribe } from "./updates/subscribe.ts";
import { start } from "./lifecycle/start.ts";
import { dispose } from "./lifecycle/dispose.ts";
import { API_ROOT } from "./store-constants.ts";

/** The store the pages read: `getSnapshot` is the current state (replaced, never mutated), `subscribe` tells when it changed. */
export type WorkbenchStore = {
  getSnapshot: () => WorkbenchState;
  subscribe: (listener: () => void) => () => void;
  actions: WorkbenchActions;
  start: () => boolean;
  dispose: () => void;
};

export function createWorkbenchStore({ apiRoot = API_ROOT }: { apiRoot?: string } = {}): WorkbenchStore {
  const ctx = initializeStoreContext(apiRoot);
  return {
    getSnapshot: () => ctx.state,
    subscribe: (listener) => subscribe(ctx, listener),
    actions: createWorkbenchActions(ctx),
    start: () => start(ctx),
    dispose: () => dispose(ctx),
  };
}
