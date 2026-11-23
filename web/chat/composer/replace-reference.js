import { safeText } from "../../workbench/payloads/safe-text.js";
export function replaceReference({ composerText, actions, attachedReferences, setComposerText, setPopupDismissed }, reference, index) {
    const shown = safeText(reference?.name) || safeText(reference?.path);
    const next = shown ? composerText.replace(`@${shown}`, "@") : `${composerText.replace(/\s*$/, "")} @`;
    actions.setReferences(attachedReferences.filter((_, itemIndex) => itemIndex !== index));
    setComposerText(next);
    setPopupDismissed(false);
  }
