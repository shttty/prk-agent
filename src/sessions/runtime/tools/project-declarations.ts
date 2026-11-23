import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { toolLazy } from "../../../config/capabilities/resolve-tool-lazy.ts";
import { isLibraryCallback } from "../../../codemode/kernel-protocol/is-library-callback.ts";
import { projectDeclarations } from "../../tool-declarations/project-declarations.ts";
import { META_TOOL_NAMES } from "../../tool-declarations/meta-tool-names.ts";
import { toolSource } from "../capabilities/classify-tool.ts";
import { toolEnabled } from "../capabilities/is-tool-enabled.ts";
import { lazyLayers } from "../capabilities/read-lazy-layers.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { localEnabled } from "../configuration/read-native-tools.ts";
import { KERNEL_CELL_TOOLS } from "../../../plugins/kernel/register-cell-tools.ts";
import { orderTools } from "../../../plugins/tool-search/order-tools.ts";

export function toolDeclarations(ctx: RuntimeContext, session: AgentSession | undefined = ctx.callbackSession) {
  const layers = lazyLayers(ctx);
  return projectDeclarations({ mode: ctx.toolMode, tools: orderTools(session?.getAllTools() ?? ctx.toolInventory)
    .filter((tool) => !isLibraryCallback(tool.name) && !Object.hasOwn(META_TOOL_NAMES, tool.name) && (!ctx.nativeNames.has(tool.name) || localEnabled(ctx)))
    .map((tool) => {
      const enabled = toolEnabled(ctx, tool.name) && (!Object.hasOwn(KERNEL_CELL_TOOLS, tool.name) || ctx.python.asyncExecution());
      const group = toolSource(ctx, tool).group;
      const lazy = toolLazy({ name: tool.name, group, exposure: tool.exposure, enabled }, layers);
      return { ...tool, promptSnippet: session?.getToolDefinition(tool.name)?.promptSnippet,
        native: ctx.nativeNames.has(tool.name), enabled,
        lazy: lazy?.available === true && lazy.enabled,
        callable: tool.exposure !== "model-only" && tool.exposure !== "hidden",
      };
    }) });
}
