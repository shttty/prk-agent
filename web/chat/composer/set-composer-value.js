import { safeText } from "../../workbench/payloads/safe-text.js";
export function setComposerValue({ setComposerText, setPopupDismissed }, value) { setComposerText(safeText(value)); setPopupDismissed(false); }
