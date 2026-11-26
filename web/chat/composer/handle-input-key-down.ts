import type { KeyboardEvent, RefObject } from "react";
import type { ComposerCommand, ExtensionCompletion, ExtensionCompletionItem, QueueMode, ReferenceCandidateView, Setter } from "./composer-types.ts";
import { referenceAvailable } from "./references/reference-available.ts";
type KeyDownContext = {
  composingRef: RefObject<boolean>; composition: boolean; referenceMenuOpen: boolean; setPopupDismissed: Setter<boolean>; references: ReferenceCandidateView[]; referenceIndex: number;
  setReferenceIndex: Setter<number>; referenceCandidates: { error: unknown; loading: boolean }; selectReference: (reference: ReferenceCandidateView | undefined) => void; popupDismissed: boolean;
  extensionCompletion: ExtensionCompletion | null; applyExtensionCompletion: (item: ExtensionCompletionItem) => Promise<void>; extensionIndex: number; commandMenuOpen: boolean;
  setExtensionIndex: Setter<number>; setCandidateIndex: Setter<number>; candidateOptions: ComposerCommand[]; candidateIndex: number; selectCandidate: (command: ComposerCommand | undefined) => void;
  composerText: string; historyCursor: number | null; recallPrompt: (delta: number) => boolean; sendDraft: (queue: QueueMode) => void; busy: boolean; otherQueue: QueueMode; queueMode: QueueMode;
};

export function handleInputKeyDown({ composingRef, composition, referenceMenuOpen, setPopupDismissed, references, referenceIndex, setReferenceIndex, referenceCandidates, selectReference, popupDismissed, extensionCompletion, applyExtensionCompletion, extensionIndex, commandMenuOpen, setExtensionIndex, setCandidateIndex, candidateOptions, candidateIndex, selectCandidate, composerText, historyCursor, recallPrompt, sendDraft, busy, otherQueue, queueMode }: KeyDownContext, event: KeyboardEvent<HTMLTextAreaElement>) {
    const composingNow = composingRef.current || composition || event.nativeEvent.isComposing || event.keyCode === 229;
    if (composingNow) return;
    if (referenceMenuOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPopupDismissed(true);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!references.some(referenceAvailable)) return;
        const delta = event.key === "ArrowDown" ? 1 : -1;
        let next = referenceIndex;
        for (let step = 0; step < references.length; step += 1) {
          next = (next + delta + references.length) % references.length;
          if (referenceAvailable(references[next])) break;
        }
        setReferenceIndex(next);
        return;
      }
      // While the @ menu is open Enter/Tab pick the highlighted row or do nothing; Enter never sends from here.
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        event.preventDefault();
        if (!referenceCandidates.loading && !referenceCandidates.error) selectReference(references[referenceIndex]);
        return;
      }
    }
    const extensionItems = !popupDismissed ? extensionCompletion?.items : null;
    if (extensionItems?.length && event.key === "Tab") {
      event.preventDefault();
      const item = extensionItems[Math.min(extensionIndex, extensionItems.length - 1)];
      if (item) void applyExtensionCompletion(item);
      return;
    }
    if (extensionItems?.length && !commandMenuOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setExtensionIndex((index) => (index + delta + extensionItems.length) % extensionItems.length);
      return;
    }
    if (commandMenuOpen || (!popupDismissed && extensionCompletion?.items?.length)) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPopupDismissed(true);
        setCandidateIndex(0);
        return;
    }
      if (commandMenuOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        if (!candidateOptions.length) return;
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setCandidateIndex((candidateIndex + delta + candidateOptions.length) % candidateOptions.length);
        return;
      }
      if (commandMenuOpen && ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab")) {
        const candidate = candidateOptions[candidateIndex] ?? candidateOptions[0];
        if (candidate) {
          event.preventDefault();
          selectCandidate(candidate);
          return;
        }
      }
    }
    const node = event.currentTarget;
    const atStart = node.selectionStart === 0 && node.selectionEnd === 0;
    const atEnd = node.selectionStart === node.value.length;
    if (event.key === "ArrowUp" && !event.shiftKey && atStart && (!composerText || historyCursor !== null) && recallPrompt(-1)) { event.preventDefault(); return; }
    if (event.key === "ArrowDown" && !event.shiftKey && atEnd && historyCursor !== null && recallPrompt(1)) { event.preventDefault(); return; }
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    // Ctrl/Cmd+Enter sends this one message with the other busy behaviour.
    if (event.ctrlKey || event.metaKey) { sendDraft(busy ? otherQueue : queueMode); return; }
    node.form?.requestSubmit();
  }
