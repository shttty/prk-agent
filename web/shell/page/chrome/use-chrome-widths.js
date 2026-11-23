import { fitWidths } from "../../layout/fit-widths.js";
import { layout } from "../../layout/layout-store.js";
import { useSplitter } from "../../layout/use-splitter.js";

/** Desktop: the session sidebar's width fitted into the window (nothing saved is rewritten by fitting) and its handle.
 * `fit` is null on the phone. */
export function useChromeWidths({ mobile, shellWidth, sessionBarOpen, chrome }) {
  const fit = mobile ? null : fitWidths({ total: shellWidth || window.innerWidth, session: { open: sessionBarOpen, width: chrome.sessionWidth } });
  const range = fit?.sessionRange ?? [0, 0];
  const clampSession = (value) => Math.round(Math.max(range[0], Math.min(range[1], value)));
  const saveSession = (value) => layout.set({ sessionWidth: clampSession(value) });
  const sessionSplitter = useSplitter("x", fit?.session ?? 0, saveSession, saveSession, clampSession, { invert: true });
  return { fit, sessionSplitter };
}
