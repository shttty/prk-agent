import type { sharedModelRuntime } from "./load-model-runtime.ts";
import type { runtimeBase } from "./load-runtime-dependencies.ts";
import type { modelCatalog } from "./list-models.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface ModelsMethods {
  sharedModelRuntime: WithoutContext<typeof sharedModelRuntime>;
  runtimeBase: WithoutContext<typeof runtimeBase>;
  modelCatalog: WithoutContext<typeof modelCatalog>;
}
