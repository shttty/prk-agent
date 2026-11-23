import type { spawnDerived } from "./spawn-derived-session.ts";
import type { manageSession } from "./manage-session.ts";
import type { derivationGet } from "./read-derivation-settings.ts";
import type { derivationSet } from "./save-derivation-settings.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface DerivationMethods {
  derivationGet: WithoutContext<typeof derivationGet>;
  derivationSet: WithoutContext<typeof derivationSet>;
  spawnDerived: WithoutContext<typeof spawnDerived>;
  manageSession: WithoutContext<typeof manageSession>;
}
