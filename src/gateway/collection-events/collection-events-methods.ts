import type { publish } from "./publish-lifecycle-event.ts";
import type { subscribeSessions } from "./subscribe-collection.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface CollectionEventsMethods {
  publish: WithoutContext<typeof publish>;
  subscribeSessions: WithoutContext<typeof subscribeSessions>;
}
