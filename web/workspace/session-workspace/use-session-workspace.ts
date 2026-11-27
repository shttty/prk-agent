import { useCallback } from "react";
import { useEffect } from "react";
import { useEffectEvent } from "react";
import { useLayoutEffect } from "react";
import { useMemo } from "react";
import { useRef } from "react";
import { useState } from "react";
import type { PageApi } from "../../shell/page/page-types.ts";
import type { Engine } from "../editor-dock/engine/engine-types.ts";
import type { PromptReport } from "../../../src/gateway/wire/web-types.ts";
import type { DiffReply } from "../file-editor/editor-types.ts";
import type { TerminalContextValue } from "../terminal/terminal-types.ts";
import type { CloseConfirm, TerminalRequest } from "./workspace-types.ts";
import { createFileStore } from "../file-store/assemble-file-store.ts";
import { useEndTerminal } from "../terminal/use-end-terminal.ts";
import { useTerminalSync } from "../terminal/use-terminal-sync.ts";

type SessionWorkspaceOptions = {
  api: PageApi; sessionId: string; target: string; engine: Engine | null; place: string; terminalEnabled: boolean; hidden: boolean; refreshKey: string;
  onShown?: () => void; terminalRequest: TerminalRequest | null; onTerminalServed: () => void; onQuote: (text: string) => void;
};

/** One session's workspace wiring around its dock `engine` (null until the dock exists), whichever page region shows the
 * dock (phone pane, desktop stage): the file store, the editor and terminal contexts, the terminal list sync and the
 * end-shell / unsaved-close confirmations. `hidden`: the dock is not shown (the terminal list is not read meanwhile).
 * `onQuote(text)`: puts a terminal selection into the session's composer.
 * Returns `{ store, editor, terminal, end, listed, metadata, confirmClose, setConfirmClose }`; `editor` and `terminal`
 * are the EditorContext / TerminalContext values. */
export function useSessionWorkspace({ api, sessionId, target, engine, place, terminalEnabled, hidden, refreshKey, onShown, terminalRequest, onTerminalServed, onQuote }: SessionWorkspaceOptions) {
  const engineRef = useRef<Engine | null>(null);
  useLayoutEffect(() => { engineRef.current = engine; }, [engine]);
  const [confirmClose, setConfirmClose] = useState<CloseConfirm | null>(null);
  const store = useMemo(() => createFileStore({
    api,
    base: `/sessions/${encodeURIComponent(sessionId)}/files`,
    // A tab restored from the saved layout whose file no longer exists is dropped without a message.
    onGone: (path: string) => { const id = engineRef.current?.findByPath(path); if (id) engineRef.current?.close(id); },
  }), [api, sessionId]);
  // Retarget keeps the sessionId and the open tabs: documents read from the previous target stay as drafts but cannot be saved there.
  // A layout effect binds the store in the same commit as the new `target` prop, before the user can act on the new UI.
  useLayoutEffect(() => { store.rebind(target); }, [store, target]);
  const requestClose = useCallback((id: string, path: string) => {
    if (store.isDirty(path)) setConfirmClose({ id, path }); else engineRef.current?.close(id);
  }, [store]);
  const loadDiff = useCallback((path: string): Promise<DiffReply> => api.post(`/sessions/${encodeURIComponent(sessionId)}/monitor/diff`, { path }), [api, sessionId]);
  const loadPrompt = useCallback(() => api.get<PromptReport>(`/sessions/${encodeURIComponent(sessionId)}/prompt`), [api, sessionId]);
  const loadPromptPart = useCallback(<Part>(part: string): Promise<Part> => api.get<Part>(`/sessions/${encodeURIComponent(sessionId)}/prompt/${part}`), [api, sessionId]);
  const closeTab = useCallback((id: string) => engineRef.current?.close(id), []);
  const editor = useMemo(() => ({ store, requestClose, loadDiff, loadPrompt, loadPromptPart, closeTab }), [store, requestClose, loadDiff, loadPrompt, loadPromptPart, closeTab]);
  const end = useEndTerminal({ api, sessionId, engine });
  const { listed, metadata, noteGeneration } = useTerminalSync({ engine, api, sessionId, enabled: terminalEnabled, hidden, refreshKey, onShown });
  const shown = useEffectEvent(() => onShown?.());
  useEffect(() => {
    if (!engine || hidden || !terminalEnabled || terminalRequest?.sessionId !== sessionId) return;
    const { name, generation } = terminalRequest;
    if (metadata[name]?.generation !== generation) return;
    engine.openTerminal(name, true);
    shown();
    onTerminalServed();
  }, [engine, hidden, terminalEnabled, terminalRequest, sessionId, metadata, onTerminalServed]);
  const terminal = useMemo((): TerminalContextValue => ({ api, sessionId, place, enabled: terminalEnabled, listed, metadata, noteGeneration, requestEnd: end.request, quote: onQuote }), [api, sessionId, place, terminalEnabled, listed, metadata, noteGeneration, end.request, onQuote]);
  return { store, editor, terminal, end, listed, metadata, confirmClose, setConfirmClose };
}
