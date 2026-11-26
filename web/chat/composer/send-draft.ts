import type { RefObject } from "react";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import type { ChatAttachment, ChatReference, QueueMode, Setter } from "./composer-types.ts";
import { hasComposerDraft } from "./has-composer-draft.ts";

type SendDraft = {
  composerText: string; composingRef: RefObject<boolean>; selectedSessionId: string; submitting: boolean; uiLoading: boolean; onSend: () => void; actions: ChatActions;
  plainMode: boolean; attachments: ChatAttachment[]; attachedReferences: ChatReference[]; setPlainMode: Setter<boolean>; setHistoryCursor: Setter<number | null>;
};

// `onSend` lets the transcript follow the new message (scroll to the end) before the request goes out.
export function sendDraft({ composerText, composingRef, selectedSessionId, submitting, uiLoading, onSend, actions, plainMode, attachments, attachedReferences, setPlainMode, setHistoryCursor }: SendDraft, queue: QueueMode) {
    const text = composerText;
    if (composingRef.current || !hasComposerDraft(text, attachments) || !selectedSessionId || submitting || uiLoading) return;
    onSend();
    void actions.sendMessage(text, { queue, mode: plainMode ? "plain" : "auto", attachments, references: attachedReferences });
    setPlainMode(false);
    setHistoryCursor(null);
  }
