import { safeText } from "../../workbench/payloads/safe-text.js";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import type { ChatReference, Setter } from "./composer-types.ts";

type ReplaceReference = { composerText: string; actions: ChatActions; attachedReferences: ChatReference[]; setComposerText: (text: string) => void; setPopupDismissed: Setter<boolean> };

export function replaceReference({ composerText, actions, attachedReferences, setComposerText, setPopupDismissed }: ReplaceReference, reference: ChatReference, index: number) {
    const shown = safeText(reference.name) || safeText(reference.path);
    const next = shown ? composerText.replace(`@${shown}`, "@") : `${composerText.replace(/\s*$/, "")} @`;
    actions.setReferences(attachedReferences.filter((_, itemIndex) => itemIndex !== index));
    setComposerText(next);
    setPopupDismissed(false);
  }
