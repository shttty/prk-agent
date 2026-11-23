import type { ToolInfo } from "@earendil-works/pi-coding-agent";
import { toolOrigin } from "../../resource-catalog/classify-tool-origin.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function toolSource(ctx: RuntimeContext, tool: Pick<ToolInfo, "name" | "sourceInfo" | "namespace">) {
    const source = ctx.nativeNames.has(tool.name) ? toolOrigin(tool, ctx.nativeNames) : ctx.remoteLoad?.origin(tool) ?? toolOrigin(tool, ctx.nativeNames);
    return ctx.nativeNames.has(tool.name) ? { ...source, ...(!ctx.target.local ? { groupLabel: "原生工具" } : {}), location: "target" as const } : source;
  }
