import { safeText } from "../../workbench/payloads/safe-text.js";
import { replaceReferenceToken } from "./references/replace-reference-token.js";
import { referenceAvailable } from "./references/reference-available.js";
export function selectReference({ referenceBase, setComposerText, composerText, setPopupDismissed, rowTarget, rowSessionId, snapshotSessionId, attachedReferences, actions }, reference) {
    const path = safeText(reference?.path);
    const name = safeText(reference?.name) || path.split("/").pop();
    if (!name || !referenceAvailable(reference)) return;
    // Inserted as the user writes it (relative or /abs); the reference itself keeps the candidate's absolute target path.
    const shown = `${referenceBase}${name}`;
    if (reference.navigable === true) {
      setComposerText(replaceReferenceToken(composerText, `@${shown}/`));
      setPopupDismissed(false);
      return;
    }
    const target = safeText(reference.target) || safeText(rowTarget);
    const sessionId = safeText(reference.sessionId) || safeText(snapshotSessionId) || safeText(rowSessionId);
    if (!path || !target || !sessionId) return;
    const value = { type: "target-file", source: "session-target", target, sessionId, path, name: shown };
    const existing = attachedReferences.findIndex((entry) => entry.path === path && entry.target === target && entry.sessionId === sessionId);
    actions.setReferences(existing >= 0 ? attachedReferences : [...attachedReferences, value]);
    setComposerText(replaceReferenceToken(composerText, `@${shown} `));
    setPopupDismissed(false);
  }
