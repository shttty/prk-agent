import type { useAui } from "@assistant-ui/react";

export function syncComposerText({ aui, composerText }: { aui: ReturnType<typeof useAui>; composerText: string }) {
    if (aui.composer.getState().text !== composerText) aui.composer.setText(composerText);
  }
