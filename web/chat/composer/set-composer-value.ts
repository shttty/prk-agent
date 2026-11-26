import { safeText } from "../../workbench/payloads/safe-text.js";
import type { Setter } from "./composer-types.ts";
export function setComposerValue({ setComposerText, setPopupDismissed }: { setComposerText: (text: string) => void; setPopupDismissed: Setter<boolean> }, value: unknown) { setComposerText(safeText(value)); setPopupDismissed(false); }
