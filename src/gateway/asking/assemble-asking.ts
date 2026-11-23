import { announceAsk } from "./publish-asking.ts";
import { syncAsk } from "./synchronize-asking.ts";
import { reconcileAsk } from "./reconcile-ui-watches.ts";
import { askWaiting } from "./read-asking.ts";
import type { HostContext } from "../host/host-state.ts";
import type { AskingMethods } from "./asking-methods.ts";

export function assembleAsking(ctx: HostContext): AskingMethods {
  return {
    announceAsk: announceAsk.bind(undefined, ctx),
    syncAsk: syncAsk.bind(undefined, ctx),
    reconcileAsk: reconcileAsk.bind(undefined, ctx),
    askWaiting: askWaiting.bind(undefined, ctx),
  };
}
