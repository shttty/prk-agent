import type { UiContext, ToolState } from "../ui-types.ts";
import type { ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { publish } from "../publication/publish-revision.ts";
import { renderTool } from "./render-tool.ts";

export function invalidateTool(ctx: UiContext, clientId: string, toolCallId: string, toolName: string, phase: "call" | "result", value: unknown, options: (ToolRenderResultOptions & { isError?: boolean; durationMs?: number }) | undefined, previous: ToolState, component: Component | undefined): void {
        if (ctx.rendering || ctx.disposed || !component || ctx.disposedComponents.has(component) || component !== (phase === "call" ? previous.callComponent : previous.resultComponent)) return;
        const before = phase === "call" ? previous.callLines : previous.resultLines;
        const oldError = ctx.toolErrors[toolCallId]?.[phase];
        ctx.rendering = true;
        try { renderTool(ctx, clientId, toolCallId, toolName, phase, value, options); }
        finally { ctx.rendering = false; }
        const after = phase === "call" ? previous.callLines : previous.resultLines;
        if (oldError !== ctx.toolErrors[toolCallId]?.[phase] || before?.length !== after?.length || after?.some((line, index) => line !== before?.[index])) publish(ctx);
      }
