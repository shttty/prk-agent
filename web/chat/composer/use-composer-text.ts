import { useCallback } from "react";
import type { useAui } from "@assistant-ui/react";
import type { ChatActions } from "../thread/chat-actions-types.ts";
export function useComposerText({ aui, actions }: { aui: ReturnType<typeof useAui>; actions: ChatActions }) {
  const setComposerText = useCallback((text: string) => {
    aui.composer.setText(text);
    actions.setDraft(text);
  }, [actions, aui]);
  return { setComposerText };
}
