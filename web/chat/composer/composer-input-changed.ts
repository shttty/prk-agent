import type { ChangeEvent } from "react";
import type { Setter } from "./composer-types.ts";

type InputChanged = { setExtensionCursor: Setter<number>; setComposerText: (text: string) => void; setCandidateIndex: Setter<number>; setHistoryCursor: Setter<number | null>; setPopupDismissed: Setter<boolean> };

export function composerInputChanged({ setExtensionCursor, setComposerText, setCandidateIndex, setHistoryCursor, setPopupDismissed }: InputChanged) {
  const inputChanged = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.currentTarget.value;
    setExtensionCursor(event.currentTarget.selectionStart);
    setComposerText(value);
    setCandidateIndex(0);
    setHistoryCursor(null);
    setPopupDismissed(false);
  };
  return { inputChanged };
}
