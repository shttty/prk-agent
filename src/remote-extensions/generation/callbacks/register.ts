import type { ExtensionAPI, ExtensionContext, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createNativeToolDefinitions } from "../../../sessions/native-coding/create-native-tool-definitions.ts";
import type { GenerationContext, Registration } from "../generation-types.ts";
import { executeTool } from "./execute-tool.ts";
import { request } from "../requests/request.ts";
import { snapshot } from "../snapshots/capture-session-snapshot.ts";
import { registerLifecycle } from "./register-lifecycle.ts";

export function register(ctx: GenerationContext, pi: ExtensionAPI, registration: Registration): void {
    const nativeDefinitions = ctx.options.nativeTools ? createNativeToolDefinitions(ctx.options.cwd) : [];
    for (const { toolId, piNativeTool, ...metadata } of registration.tools) {
      const native = piNativeTool ? nativeDefinitions.find((tool) => tool.name === metadata.name) : undefined;
      if (piNativeTool && !native) throw new Error(`Unexpected remote Pi native tool: ${metadata.name}`);
      // Only public native definitions supply local argument preparation/rendering.
      // Execute is always the target stub, never the definition's local executor.
      const tool = { ...native, ...metadata, execute: async (toolCallId, args, signal, update, sdkContext) => executeTool(ctx, pi, toolId, toolCallId, args, signal, update, sdkContext) } satisfies ToolDefinition;
      pi.registerTool(native && ctx.options.mapNativeTool ? ctx.options.mapNativeTool(tool) : tool);
    }
    for (const command of registration.commands) {
      pi.registerCommand(command.name, {
        description: command.description,
        async handler(args, sdkContext) {
          await request(ctx, "command", { name: command.name, args, snapshot: snapshot(ctx, pi, sdkContext) }, { signal: sdkContext.signal });
        },
      });
    }
    for (const { event, handlerId } of registration.handlers) {
      if (event === "session_shutdown") continue;
      // Registration names were validated by the remote capability table. Pi owns handler ordering/results.
      const on = pi.on as unknown as (name: string, handler: (event: Record<string, unknown>, sdkContext: ExtensionContext) => Promise<unknown>) => () => void;
      on(event, async (input, sdkContext) => {
        const { signal, ...eventData } = input;
        const callbackSignal = (signal as AbortSignal | undefined) ?? sdkContext.signal;
        const result = await request(ctx, "event", { handlerId, event: eventData, snapshot: snapshot(ctx, pi, sdkContext), hasSignal: callbackSignal !== undefined, aborted: callbackSignal?.aborted }, { signal: callbackSignal }) as { result: unknown; event: Record<string, unknown> };
        // Only tool_call input is mutable in this supported event set.
        if (event === "tool_call") {
          const original = input.input as Record<string, unknown>;
          for (const key of Object.keys(original)) delete original[key];
          Object.assign(original, result.event.input);
        }
        return result.result;
      });
    }
    registerLifecycle(ctx, pi);
}
