import type { SessionRuntimeDependencies } from "../../runtime/runtime-types.ts";
import type { CollectionContext } from "../collection-state.ts";

export async function runtimeDependencies(ctx: CollectionContext): Promise<SessionRuntimeDependencies> {
    if (ctx.options.getRuntimeDependencies) return ctx.options.getRuntimeDependencies();
    if (ctx.options.runtimeDependencies) return ctx.options.runtimeDependencies;
    throw new Error("Session runtime dependencies are unavailable; provide an explicit model and model runtime.");
  }
