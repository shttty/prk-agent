import { hasComposerDraft } from "./has-composer-draft.js";

// `onSend` lets the transcript follow the new message (scroll to the end) before the request goes out.
export function sendDraft({ composerText, composingRef, selectedSessionId, submitting, uiLoading, onSend, actions, plainMode, attachments, attachedReferences, setPlainMode, setHistoryCursor }, queue) {
    const text = composerText;
    if (composingRef.current || !hasComposerDraft(text, attachments) || !selectedSessionId || submitting || uiLoading) return;
    onSend();
    void actions.sendMessage(text, { queue, mode: plainMode ? "plain" : "auto", attachments, references: attachedReferences });
    setPlainMode(false);
    setHistoryCursor(null);
  }
