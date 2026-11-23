import type { UiContext, ClientState, HostedNode, MessageLike } from "../ui-types.ts";
import type { ToolResultMessage } from "@earendil-works/pi-ai";
import { textLines } from "./format-messages.ts";
import { renderError } from "../describe-render-error.ts";
import { resolveRenderers } from "../tools/resolve-tool-renderers.ts";
import { requireTheme } from "../theme/require-theme.ts";
import { disposeComponent } from "../components/dispose-component.ts";
import { descriptor } from "../components/descriptor.ts";
import { snapshot } from "../publication/get-snapshot.ts";
import { renderTool } from "../tools/render-tool.ts";
import { readonlyRenderer } from "./readonly-renderer.ts";
import { getKeybindingHints } from "../tui/input/get-keybinding-hints.ts";
import { sessionEntryToContextMessages } from "@earendil-works/pi-coding-agent";
import { projectBranchPage } from "../../history/project-branch-page.ts";

export function render(ctx: UiContext, width: number, height: number, clientId: string, expandedToolCallIds: readonly string[] = [], operationId?: string, historyStart?: string): unknown {
    const previous = ctx.clients.get(clientId);
    const client: ClientState = { width: Number.isFinite(width) && width > 0 ? Math.floor(width) : 100, height: Number.isFinite(height) && height > 0 ? Math.floor(height) : 40, expandedToolCallIds: new Set(expandedToolCallIds), nodes: new Map(), renderers: new Map() };
    const rendererErrors: Array<{ id: string; message: string }> = [];
    const keybindingHints = getKeybindingHints(ctx);
    
    ctx.rendering = true;
    ctx.clients.set(clientId, client);
    try {
    ctx.toolErrors = {};
    const current = snapshot(ctx);
    const widgets = [...ctx.state.widgets].map(([key, widget]) => ({ key, placement: widget.placement, node: widget.component ? descriptor(ctx, widget.component, client, `widget-${key}`) : { id: `widget-${key}`, kind: "text" as const, lines: widget.lines ?? [] } }));
    const prompts = current.prompts.map((prompt) => {
      if (!ctx.custom || ctx.custom.id !== prompt.id) return prompt;
      const primaryOptions = typeof ctx.custom.options?.overlayOptions === "function" ? ctx.custom.options.overlayOptions() : ctx.custom.options?.overlayOptions;
      const { visible: predicate, ...geometry } = primaryOptions ?? {};
      const primaryRemoved = ctx.custom.primary && !ctx.custom.overlays.has(ctx.custom.primary.id);
      const hidden = ctx.custom.primary?.hidden === true || primaryRemoved === true || predicate?.(client.width, client.height) === false;
      return { ...prompt, ...(ctx.custom.overlay ? { overlay: geometry } : {}), hidden, focused: !hidden && (ctx.custom.primary?.focused ?? !ctx.custom.overlay), node: hidden ? undefined : descriptor(ctx, ctx.custom.component, client, `custom-${ctx.custom.id}`), overlays: [...ctx.custom.overlays.values()].filter((overlay) => overlay.id !== ctx.custom?.primary?.id).map((overlay) => {
        const { visible, ...options } = overlay.options ?? {};
        const hidden = overlay.hidden || visible?.(client.width, client.height) === false;
        return { id: overlay.id, hidden, focused: !hidden && overlay.focused, options, node: hidden ? undefined : descriptor(ctx, overlay.component, client, `overlay-${overlay.id}`) };
      }) };
    });
    const toolsOut: Record<string, { shell: "default" | "self"; call?: HostedNode; result?: HostedNode }> = {};
    const toolNames: Record<string, string> = {};
    const metaCallArgs = new Map<string, unknown>();
    const messages: Record<string, { text?: string; node?: HostedNode }> = {};
    let streamingText: string | undefined;
    const entries: Array<{ id: string; node: HostedNode; beforeEntryId: string | null }> = [];
    const manager = ctx.session.sessionManager;
    const branch = manager.getBranch();
    const oldest = branch.findIndex((entry) => entry.id === historyStart);
    const fallback = oldest < 0 ? projectBranchPage(manager) : undefined;
    const start = oldest >= 0 ? oldest : fallback?.historyBefore ? branch.findIndex((entry) => entry.id === fallback.historyBefore) : 0;
    const visible = branch.slice(start);
    const timeline = visible.flatMap((entry) => entry.type === "compaction" ? [] : sessionEntryToContextMessages(entry).map((message) => ({ entryId: entry.id as string | undefined, message })));
    const streaming = ctx.session.state.streamingMessage;
    if (streaming) timeline.push({ entryId: undefined, message: streaming });
    for (const { entryId, message } of timeline) {
      const currentMessage = message as unknown as MessageLike & Pick<ToolResultMessage, "nestedCalls">;
      const role = currentMessage.role;
      if (role === "custom" && currentMessage.display === false) continue;
      if (role === "assistant" || role === "user" || role === "toolResult" || role === "custom" || role === "branchSummary" || role === "compactionSummary") {
        const rawText = role === "branchSummary" || role === "compactionSummary" ? currentMessage.summary ?? "" : textLines(currentMessage.content).join("\n");
        const transformers = role === "user" || role === "assistant" ? ctx.session.extensionRunner.getMarkdownTransformers() : [];
        let transformed = rawText;
        try { transformed = transformers.reduce((value, transformer) => transformer(value, { messageType: role as "user" | "assistant", isStreaming: entryId === undefined, availableWidth: client.width }), rawText); }
        catch (error) { rendererErrors.push({ id: `markdown-${entryId ?? "live"}`, message: renderError(error) }); }
        if (entryId === undefined && role === "assistant") streamingText = transformed;
        const item: { text?: string; node?: HostedNode } = transformed !== rawText ? { text: transformed } : {};
        if (role === "custom" && typeof currentMessage.customType === "string") {
          const renderer = ctx.session.extensionRunner.getMessageRenderer(currentMessage.customType);
          if (renderer) item.node = readonlyRenderer(ctx, client, rendererErrors, `message-${entryId ?? "live"}`, () => renderer(message as Parameters<typeof renderer>[0], { expanded: false, outputPad: ctx.session.settingsManager.getOutputPad(), ...keybindingHints }, requireTheme(ctx)));
        }
        if (role === "toolResult" && typeof currentMessage.toolCallId === "string" && typeof currentMessage.toolName === "string") {
          toolNames[currentMessage.toolCallId] = currentMessage.toolName;
          const expanded = client.expandedToolCallIds.has(currentMessage.toolCallId) || ctx.state.toolsExpanded;
          const node = renderTool(ctx, clientId, currentMessage.toolCallId, currentMessage.toolName, "result", { content: Array.isArray(currentMessage.content) ? currentMessage.content : [], details: currentMessage.details }, { expanded, isPartial: false, isError: currentMessage.isError === true, durationMs: currentMessage.durationMs });
          toolsOut[currentMessage.toolCallId] = { ...(toolsOut[currentMessage.toolCallId] ?? { shell: "default" }), ...(node ? { result: node } : {}) };
          if (currentMessage.toolName === "tool_call") {
            const own = currentMessage.nestedCalls?.calls.find((call) => call.id === `${currentMessage.toolCallId}/1`);
            const input = metaCallArgs.get(currentMessage.toolCallId);
            const args = own?.arguments ?? (typeof input === "object" && input !== null && "args" in input ? input.args : undefined);
            if (own && args !== undefined) {
              toolNames[own.id] = own.name;
              const call = renderTool(ctx, clientId, own.id, own.name, "call", args);
              const expanded = client.expandedToolCallIds.has(own.id) || ctx.state.toolsExpanded;
              const result = renderTool(ctx, clientId, own.id, own.name, "result", { content: Array.isArray(currentMessage.content) ? currentMessage.content : [], details: currentMessage.details }, { expanded, isPartial: false, isError: currentMessage.isError === true, durationMs: own.durationMs });
              toolsOut[own.id] = { shell: "default", ...(call ? { call } : {}), ...(result ? { result } : {}) };
            }
          }
        }
        if (role === "assistant" && Array.isArray(currentMessage.content)) {
          for (const part of currentMessage.content) if (typeof part === "object" && part !== null && "type" in part && part.type === "toolCall") {
            const toolCall = part as { type: "toolCall"; id: string; name: string; arguments: unknown };
            if (toolCall.name === "tool_call") metaCallArgs.set(toolCall.id, toolCall.arguments);
            toolNames[toolCall.id] = toolCall.name;
            const node = renderTool(ctx, clientId, toolCall.id, toolCall.name, "call", toolCall.arguments);
            toolsOut[toolCall.id] = { ...(toolsOut[toolCall.id] ?? { shell: "default" }), ...(node ? { call: node } : {}) };
          }
        }
        if (entryId !== undefined && (item.text !== undefined || item.node)) messages[entryId] = item;
      }
    }
    for (const [toolCallId, execution] of ctx.executions) {
      if (execution.parentToolCallId && toolsOut[toolCallId]) continue;
      toolNames[toolCallId] = execution.toolName;
      if (execution.parentToolCallId) {
        const node = renderTool(ctx, clientId, toolCallId, execution.toolName, "call", execution.args);
        toolsOut[toolCallId] = { ...(toolsOut[toolCallId] ?? { shell: "default" }), ...(node ? { call: node } : {}) };
      }
      if ((!execution.partial && !execution.parentToolCallId) || execution.result === undefined) continue;
      const expanded = client.expandedToolCallIds.has(toolCallId) || ctx.state.toolsExpanded;
      const node = renderTool(ctx, clientId, toolCallId, execution.toolName, "result", execution.result, { expanded, isPartial: execution.partial, isError: execution.isError, durationMs: execution.durationMs });
      toolsOut[toolCallId] = { ...(toolsOut[toolCallId] ?? { shell: "default" }), ...(node ? { result: node } : {}) };
    }
    for (const [id, tool] of Object.entries(toolsOut)) {
      const toolName = toolNames[id];
      if (toolName) {
        try { const renderers = resolveRenderers(ctx, toolName); tool.shell = renderers?.renderCall || renderers?.renderResult ? renderers.renderShell ?? "default" : "default"; }
        catch (error) { ctx.toolErrors[id] = { ...ctx.toolErrors[id], call: renderError(error) }; }
      }
    }
    const messageIds = new Set(timeline.map(({ entryId }) => entryId));
    let beforeEntryId: string | null = null;
    for (let index = visible.length - 1; index >= 0; index--) {
      const entry = visible[index];
      if (messageIds.has(entry.id)) beforeEntryId = entry.id;
      if (entry.type !== "custom") continue;
      const renderer = ctx.session.extensionRunner.getEntryRenderer(entry.customType);
      if (!renderer) continue;
      const node = readonlyRenderer(ctx, client, rendererErrors, `entry-${entry.id}`, () => renderer(entry as Parameters<typeof renderer>[0], { expanded: false, ...keybindingHints }, requireTheme(ctx)));
      if (node) entries.push({ id: entry.id, node, beforeEntryId });
      else if (rendererErrors.some((error) => error.id === `entry-${entry.id}`)) entries.push({ id: entry.id, node: { id: `entry-${entry.id}`, kind: "text", lines: [`${entry.customType}: ${JSON.stringify(entry.data)}`] }, beforeEntryId });
    }
    return { ...current, ...(operationId && streamingText !== undefined ? { streaming: { operationId, text: streamingText } } : {}), widgets, header: descriptor(ctx, ctx.state.header, client, "header"), footer: descriptor(ctx, ctx.state.footer, client, "footer"), prompts, tools: toolsOut, toolErrors: ctx.toolErrors, rendererErrors, messages, entries: entries.reverse() };
    } finally {
      const retained = new Set([...ctx.clients.values()].flatMap((client) => [...client.renderers.values()]));
      for (const component of previous?.renderers.values() ?? []) if (!retained.has(component)) disposeComponent(ctx, component);
      ctx.rendering = false;
    }
  }
