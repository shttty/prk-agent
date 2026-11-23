import { isLibraryCallback } from "../../../codemode/kernel-protocol/is-library-callback.ts";
import { capabilityEnabled } from "./is-capability-enabled.ts";
import { toolSource } from "./classify-tool.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function toolEnabled(ctx: RuntimeContext, name: string): boolean {
    if (isLibraryCallback(name)) return ctx.python.getSnapshot().language === "python";
    if (name === "kernel_code" && ctx.toolMode === "code") return true;
    if (name.startsWith("prk_saved_")) return ctx.python.getSnapshot().language === "python" && capabilityEnabled(ctx, `tool:${name}`, "group:tools:library");
    const tool = ctx.toolInventory.find((tool) => tool.name === name) ?? ctx.callbackSession?.getAllTools().find((tool) => tool.name === name);
    if (!tool) return capabilityEnabled(ctx, `tool:${name}`);
    return capabilityEnabled(ctx, `tool:${name}`, toolSource(ctx, tool).group);
  }
