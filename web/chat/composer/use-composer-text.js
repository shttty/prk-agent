import { useCallback } from "react";
export function useComposerText(ctx) {
  const { aui, actions } = ctx;
  const setComposerText = useCallback((text) => {
    aui.composer.setText(text);
    actions.setDraft(text);
  }, [actions, aui]);
  return { setComposerText };
}
