import type { SessionRuntimeDependencies } from "../../sessions/runtime/runtime-types.ts";
import type { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import type { ModelProviderOwnership } from "../../sessions/model-providers/provider-types.ts";
import type { SessionHostSnapshot } from "../../sessions/host/host-types.ts";

export interface ModelState {
  runtimeDependencies: Promise<SessionRuntimeDependencies> | undefined;
  modelRuntime: Promise<SessionRuntimeDependencies["modelRuntime"]> | undefined;
  modelProviders?: ModelProviderOwnership;
  providerRuntime?: AgentSessionRuntime;
  providerDiagnostics?: readonly string[];
  resolvedModelRuntime?: SessionRuntimeDependencies["modelRuntime"];
  modelFallbacks: Map<string, NonNullable<SessionHostSnapshot["modelFallback"]>>;
}
