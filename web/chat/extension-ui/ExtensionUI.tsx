import "./extension-ui.css";
import { memo } from "react";
import { useRef } from "react";
import { useState } from "react";
import { useEffect } from "react";
import { useEffectEvent } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.ts";
import { useStopTarget } from "../../workbench/subscription/use-stop-target.js";
import { useWorkbenchStore } from "../../workbench/subscription/use-workbench-store.ts";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import type { OverlayGeometry } from "./Overlay.tsx";
import type { ExtensionPrompt } from "../../workbench/store/extension-ui/extension-render-types.ts";
import { extensionUiRenderTriggerKey } from "./extension-ui-render-trigger-key.ts";
import { stripAnsi } from "../ansi/strip-ansi.ts";
import { pruneAskDrafts } from "../ask/prune-ask-drafts.ts";
import { askStopTarget } from "../ask/ask-stop-target.ts";
import { AskDialog } from "../ask/AskDialog.tsx";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { Prompt } from "./Prompt.tsx";
import { ExtensionRegion } from "./ExtensionRegion.tsx";
import { Overlay } from "./Overlay.tsx";
/**
 * The tray above the composer: everything transient a plugin raises, stacked by priority — dialogs waiting for an
 * answer (and non-overlay `ctx.ui.custom`) on top, then widgets (aboveEditor, belowEditor; the todo float is the todo
 * plugin's widget). Nothing replaces the composer. Overlay `ctx.ui.custom` floats on its own (position: fixed). Status
 * entries live under the composer (ExtensionStatus), notices as toasts (ExtensionToasts).
 */
export const ExtensionUI = memo(function ExtensionUI({ actions }: { actions: ChatActions }) {
  const store = useWorkbenchStore();
  const render = useWorkbench((state) => state.session.extensionUiRender);
  const snapshot = useWorkbench((state) => state.session.extensionUi);
  const streamId = useWorkbench((state) => state.session.streamId);
  const clientId = useWorkbench((state) => state.session.extensionUiClientId);
  const toolContents = useWorkbench((state) => state.session.toolContents);
  const askSession = useWorkbench((state) => state.session.snapshot?.sessionId || state.selectedSessionId || "");
  const stopTarget = useStopTarget();
  const hostRef = useRef<HTMLDivElement>(null);
  const metricRef = useRef<HTMLSpanElement>(null);
  // The terminal size the Gateway renders plugin components at: host width and viewport height over one measured character cell.
  const [geometry, setGeometry] = useState<OverlayGeometry>({ width: 0, height: 0, cellWidth: 1, cellHeight: 1 });
  const renderTriggerKey = useWorkbench((state) => extensionUiRenderTriggerKey(state, geometry));
  useEffect(() => {
    const host = hostRef.current;
    const metric = metricRef.current;
    if (!host || !metric) return undefined;
    const update = () => {
      const rect = metric.getBoundingClientRect();
      const cellWidth = rect.width / 10;
      const cellHeight = rect.height;
      if (!cellWidth || !cellHeight) return;
      const next = { width: Math.max(1, Math.floor(host.clientWidth / cellWidth)), height: Math.max(1, Math.floor((window.visualViewport?.height || window.innerHeight) / cellHeight)), cellWidth, cellHeight };
      setGeometry((previous) => previous.width === next.width && previous.height === next.height && previous.cellWidth === next.cellWidth && previous.cellHeight === next.cellHeight ? previous : next);
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(host);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    void document.fonts?.ready.then(update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); window.visualViewport?.removeEventListener("resize", update); };
  }, []);
  useEffect(() => () => actions.requestExtensionUiRender(null), [actions]);
  const requestRender = useEffectEvent(() => {
    const state = store.getSnapshot();
    if (!snapshot || !geometry.width || !state.extensionUiRenderIntervalMs) return;
    const toolPrefix = `${state.session.snapshot?.sessionId}:${state.selectedSessionId}:`;
    const expandedToolCallIds = (Array.isArray(state.presentation?.openedTools) ? state.presentation.openedTools : []).filter((key) => key.startsWith(toolPrefix)).map((key) => key.slice(toolPrefix.length));
    const operationId = state.session.snapshot?.operation?.operationId;
    actions.requestExtensionUiRender({ width: geometry.width, height: geometry.height, expandedToolCallIds, ...(operationId ? { operationId } : {}) });
  });
  useEffect(() => {
    requestRender();
  }, [renderTriggerKey, toolContents]);
  const act = (args: Record<string, unknown>) => actions.extensionUiAction(String(args.operation), args);
  const editor = snapshot?.editor && (!render?.editor || snapshot.editor.revision >= render.editor.revision) ? snapshot.editor : render?.editor;
  const editorRevisionRef = useRef<number | null>(null);
  // Read the live cells at click time: subscribing would re-render the tray on every kernel telemetry tick.
  const stopAsk = (prompt: ExtensionPrompt) => {
    const state = store.getSnapshot();
    const target = askStopTarget(prompt, stopTarget, { sessionId: state.selectedSessionId, streamId: state.session.streamId, activeCells: state.session.snapshot?.kernel?.activeCells });
    if (target) void actions.cancelOperation(target, prompt.id);
  };
  useEffect(() => { editorRevisionRef.current = null; }, [streamId, clientId]);
  useEffect(() => {
    if (!editor || !Number.isSafeInteger(editor.revision) || editorRevisionRef.current === editor.revision || typeof editor.text !== "string") return;
    editorRevisionRef.current = editor.revision;
    if (editor.revision > 0 && editor.clientId !== clientId && editor.text !== store.getSnapshot().draft) actions.setDraft(editor.text);
  }, [actions, editor, clientId, store]);
  // Data dialogs need no component render round trip; snapshot removal also retires stale cards.
  const prompts = (snapshot?.prompts ?? render?.prompts ?? []).flatMap((prompt: ExtensionPrompt) => {
    if (prompt.kind !== "custom") return [prompt];
    const rendered = render?.prompts?.find((item) => item.id === prompt.id);
    return rendered ? [rendered] : [];
  });
  const cards = [...prompts.filter((prompt) => !prompt.overlay && prompt.kind !== "custom" && prompt.kind !== "ask"), ...prompts.filter((prompt) => prompt.kind === "custom" && !prompt.overlay)];
  // `ask` cards come straight from the scalar snapshot: it advances with every action's reply, so an answered card goes at once.
  const asks = (snapshot?.prompts || []).filter((prompt) => prompt.kind === "ask");
  const askIds = asks.map((prompt) => prompt.id).join("|");
  const hasSnapshot = Boolean(snapshot);
  useEffect(() => { if (hasSnapshot) pruneAskDrafts(askSession, askIds ? askIds.split("|") : []); }, [hasSnapshot, askSession, askIds]);
  return <div ref={hostRef} className="extension-ui-host pi-tray" data-extension-ui-revision={snapshot?.revision ?? render?.revision} data-stream-id={streamId}>
    <span ref={metricRef} className="extension-ui-metric" aria-hidden="true">MMMMMMMMMM</span>
    {(render?.rendererErrors || []).map((error) => <InlineAlert key={error.id} data-extension-renderer-error={error.id}>{stripAnsi(error.message)}</InlineAlert>)}
    {prompts.filter((prompt) => prompt.overlay).map((prompt, index) => <Overlay key={prompt.id} prompt={prompt} index={index} actions={act} geometry={geometry} />)}
    {prompts.flatMap((prompt) => (prompt.overlays || []).map(({ options, ...overlay }, index) => <Overlay key={overlay.id} prompt={{ ...overlay, kind: "custom", overlay: options || {}, parentId: prompt.id }} index={prompts.length + index} actions={act} geometry={geometry} />))}
    {cards.map((prompt) => <Prompt key={prompt.id} prompt={prompt} actions={act} />)}
    {asks.map((prompt) => <AskDialog key={prompt.id} prompt={prompt} sessionKey={askSession} onAction={act} onStop={() => stopAsk(prompt)} />)}
    <ExtensionRegion actions={actions} placement="aboveEditor" />
    <ExtensionRegion actions={actions} placement="belowEditor" />
  </div>;
});
