import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createNativeToolDefinitions } from "../../../sessions/native-coding/create-native-tool-definitions.ts";
import type { GenerationContext } from "../generation-types.ts";
import { executeTool } from "./execute-tool.ts";
import { registerLifecycle } from "./register-lifecycle.ts";

/** Register public Pi definitions without deploying or loading their target executor. */
export function registerNativeTools(ctx: GenerationContext, pi: ExtensionAPI): void {
  for (const native of createNativeToolDefinitions(ctx.options.cwd)) {
    const tool: ToolDefinition = {
      ...native,
      execute: async (toolCallId, args, signal, update, sdkContext) => {
        if (ctx.failure) throw ctx.failure;
        if (ctx.closing) throw new Error("Remote extension generation is closing.");
        if (signal?.aborted) throw new Error("Operation aborted");
        const registration = await ctx.start();
        const target = registration.tools.find((entry) => entry.piNativeTool && entry.name === native.name);
        if (!target) throw new Error(`Remote Pi native tool was not registered: ${native.name}`);
        return executeTool(ctx, pi, target.toolId, toolCallId, args, signal, update, sdkContext);
      },
    };
    pi.registerTool(ctx.options.mapNativeTool?.(tool) ?? tool);
  }
  registerLifecycle(ctx, pi);
}
