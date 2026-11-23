import { capabilityEnabled } from "../capabilities/is-capability-enabled.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function libraryEntries(ctx: RuntimeContext) { return ctx.dependencies.toolLibrary?.list().filter((entry) => entry.status !== "archived" && capabilityEnabled(ctx, `tool:prk_saved_${entry.name}`, "group:tools:library")) ?? []; }
