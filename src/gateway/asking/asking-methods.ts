import type { announceAsk } from "./publish-asking.ts";
import type { syncAsk } from "./synchronize-asking.ts";
import type { reconcileAsk } from "./reconcile-ui-watches.ts";
import type { askWaiting } from "./read-asking.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface AskingMethods {
  announceAsk: WithoutContext<typeof announceAsk>;
  syncAsk: WithoutContext<typeof syncAsk>;
  reconcileAsk: WithoutContext<typeof reconcileAsk>;
  askWaiting: WithoutContext<typeof askWaiting>;
}
