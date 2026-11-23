import { sharedModelRuntime } from "./load-model-runtime.ts";
import { runtimeBase } from "./load-runtime-dependencies.ts";
import { modelCatalog } from "./list-models.ts";
import type { HostContext } from "../host/host-state.ts";
import type { ModelsMethods } from "./models-methods.ts";

export function assembleModels(ctx: HostContext): ModelsMethods {
  return {
    sharedModelRuntime: sharedModelRuntime.bind(undefined, ctx),
    runtimeBase: runtimeBase.bind(undefined, ctx),
    modelCatalog: modelCatalog.bind(undefined, ctx),
  };
}
