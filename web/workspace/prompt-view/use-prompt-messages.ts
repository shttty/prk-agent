import { useCallback, useEffect, useState } from "react";
import type { PromptMessagesPart } from "../../../src/gateway/wire/web-types.ts";
import { useEditorContext } from "../file-editor/use-editor-context.ts";
import type { MessagesState } from "./messages-types.ts";

export const MESSAGE_PAGE = 50;
/** How many entries of the last user turn start open; the rest of a long turn stays one line each. */
const OPEN_FROM_TURN = 8;

/** The conversation of the request `seq`, newest page first: `loadEarlier` reads the page before what is held. Entries are read whole, one page per call. */
export function usePromptMessages(total: number, seq: number) {
  const { loadPromptPart } = useEditorContext();
  const [state, setState] = useState<MessagesState>({ status: "loading" });
  const [earlier, setEarlier] = useState(false);
  useEffect(() => {
    if (total === 0) return undefined;
    let live = true;
    const offset = Math.max(0, total - MESSAGE_PAGE);
    loadPromptPart<PromptMessagesPart>(`messages?offset=${offset}&limit=${total - offset}`).then((page) => {
      // A newer request answered meanwhile: its own announcement reloads the panel, so this page is dropped.
      if (!live || page.seq !== seq) return;
      const turn = page.turnStart ?? total;
      const opened = new Set(Array.from({ length: OPEN_FROM_TURN }, (_, step) => turn + step).filter((index) => index >= offset && index < total));
      setState({ status: "ok", loaded: { first: offset, messages: page.messages, outline: page.outline, opened } });
    }).catch((error: unknown) => { if (live) setState({ status: "error", message: error instanceof Error ? error.message : "无法读取消息。" }); });
    return () => { live = false; };
  }, [loadPromptPart, total, seq]);
  const loadEarlier = useCallback(() => {
    if (state.status !== "ok" || earlier || state.loaded.first === 0) return;
    const { loaded } = state;
    const offset = Math.max(0, loaded.first - MESSAGE_PAGE);
    setEarlier(true);
    loadPromptPart<PromptMessagesPart>(`messages?offset=${offset}&limit=${loaded.first - offset}`).then((page) => {
      if (page.seq === seq) setState({ status: "ok", loaded: { ...loaded, first: offset, messages: [...page.messages, ...loaded.messages], outline: [...page.outline, ...loaded.outline] } });
    }).catch((error: unknown) => setState({ status: "error", message: error instanceof Error ? error.message : "无法读取消息。" })).finally(() => setEarlier(false));
  }, [loadPromptPart, seq, state, earlier]);
  return { state, loadEarlier, loadingEarlier: earlier };
}
