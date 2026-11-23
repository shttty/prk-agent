import type { UiContext, HostedNode, ToolState, ToolRenderContext } from "../ui-types.ts";
import type { ToolRenderResultOptions, ToolRenderers } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { renderError } from "../describe-render-error.ts";
import { resolveRenderers } from "./resolve-tool-renderers.ts";
import { requireTheme } from "../theme/require-theme.ts";
import { disposeComponent } from "../components/dispose-component.ts";
import { invalidateTool } from "./invalidate.ts";
import { getKeybindingHints } from "../tui/input/get-keybinding-hints.ts";

export function renderTool(ctx: UiContext, clientId: string, toolCallId: string, toolName: string, phase: "call" | "result", value: unknown, options?: ToolRenderResultOptions & { isError?: boolean; durationMs?: number }): HostedNode | undefined {
    const client = ctx.clients.get(clientId);
    if (!client) return undefined;
    const stateKey = `${clientId}:${toolCallId}`;
    const previous: ToolState = ctx.tools.get(stateKey) ?? { state: {}, args: phase === "call" ? value : ctx.executions.get(toolCallId)?.args ?? {} };
    if (phase === "call") previous.args = value;
    ctx.tools.set(stateKey, previous);
    let component: Component | undefined;
    const lastComponent = phase === "call" ? previous.callComponent : previous.resultComponent;
    try {
      const renderers = resolveRenderers(ctx, toolName);
      const renderer = phase === "call" ? renderers?.renderCall : renderers?.renderResult;
      if (!renderer) return undefined;
      const execution = ctx.executions.get(toolCallId);
      const invalidate = (): void => invalidateTool(ctx, clientId, toolCallId, toolName, phase, value, options, previous, component);
      const streaming = ctx.session.state.streamingMessage;
      const streamingCall = streaming && "content" in streaming && Array.isArray(streaming.content) && streaming.content.some((part) => part.type === "toolCall" && part.id === toolCallId);
      const expanded = options?.expanded ?? (client.expandedToolCallIds.has(toolCallId) || ctx.state.toolsExpanded);
      const renderContext: ToolRenderContext = { args: previous.args, toolCallId, invalidate, lastComponent, state: previous.state, cwd: ctx.session.sessionManager.getCwd(), executionStarted: execution?.started ?? phase === "result", argsComplete: execution?.started === true || !streamingCall, isPartial: options?.isPartial ?? execution?.partial ?? false, expanded, showImages: ctx.session.settingsManager.getShowImages(), isError: options?.isError ?? execution?.isError ?? false, durationMs: options?.durationMs ?? execution?.durationMs, outputPad: ctx.session.settingsManager.getOutputPad(), ...getKeybindingHints(ctx) };
      const theme = requireTheme(ctx);
      if (phase === "call" && renderers?.renderCall) component = renderers.renderCall(value, theme, renderContext);
      else if (phase === "result" && renderers?.renderResult) component = renderers.renderResult(value as Parameters<NonNullable<ToolRenderers["renderResult"]>>[0], { expanded, isPartial: options?.isPartial ?? false }, theme, renderContext);
      if (!component) return undefined;
      const lines = component.render(client.width);
      if (phase === "call") { previous.callComponent = component; previous.callLines = [...lines]; } else { previous.resultComponent = component; previous.resultLines = [...lines]; }
      if (ctx.toolErrors[toolCallId]) delete ctx.toolErrors[toolCallId]![phase];
      if (lastComponent !== component && lastComponent !== previous.callComponent && lastComponent !== previous.resultComponent) disposeComponent(ctx, lastComponent);
      return { id: `tool-${toolCallId}-${phase}`, kind: "text", lines };
    } catch (error) {
      ctx.toolErrors[toolCallId] = { ...ctx.toolErrors[toolCallId], [phase]: renderError(error) };
      if (phase === "call") { previous.callComponent = undefined; previous.callLines = undefined; } else { previous.resultComponent = undefined; previous.resultLines = undefined; }
      if (component !== previous.callComponent && component !== previous.resultComponent) disposeComponent(ctx, component);
      if (lastComponent !== previous.callComponent && lastComponent !== previous.resultComponent) disposeComponent(ctx, lastComponent);
      return undefined;
    }
  }
