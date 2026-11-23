import type { HostContext } from "../host/host-state.ts";
import type { SessionRuntimeDependencies } from "../../sessions/runtime/runtime-types.ts";
import { sdkRuntimeDependencies } from "./resolve-runtime-dependencies.ts";

export async function runtimeBase(ctx: HostContext): Promise<SessionRuntimeDependencies> {
  return ctx.models.runtimeDependencies ??= ctx.methods.sharedModelRuntime().then((runtime) => ({
    ...(ctx.host.dependencies.runtimeDependencies ?? sdkRuntimeDependencies(ctx.host.options, ctx.host.config, ctx.host.paths.agentDir, runtime)),
    modelProviders: ctx.models.modelProviders,
  }));
 }
