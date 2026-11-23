import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { RuntimeContext } from "../runtime-state.ts";
import { localEnabled } from "../configuration/read-native-tools.ts";

/** One registered name; PRK file IO remains target-side when native tools are off. */
export function dispatchNativeTool(ctx: RuntimeContext, native: ToolDefinition): ToolDefinition {
  const outlet = ctx.fileTools.find((tool) => tool.name === native.name);
  if (!outlet) return native;
  return {
    ...native,
    execute: (...args) => {
      if (ctx.python.isFileCallback(native.name)) {
        if (localEnabled(ctx)) throw new Error(`${native.name} 在本会话已关闭`);
        return outlet.execute(...args);
      }
      return native.execute(...args);
    },
  };
}
