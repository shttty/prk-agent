import type { LayoutState } from "../../layout/layout-types.ts";
import { fitWidths } from "../../layout/fit-widths.ts";
import { layout } from "../../layout/layout-store.ts";
import { useSplitter } from "../../layout/use-splitter.ts";

/** Desktop: the session sidebar's width fitted into the window (nothing saved is rewritten by fitting) and its handle.
 * `fit` is null on the phone. */
type ChromeWidthsOptions = { mobile: boolean; shellWidth: number; sessionBarOpen: boolean; chrome: LayoutState };

export function useChromeWidths({ mobile, shellWidth, sessionBarOpen, chrome }: ChromeWidthsOptions) {
  const fit = mobile ? null : fitWidths({ total: shellWidth || window.innerWidth, session: { open: sessionBarOpen, width: chrome.sessionWidth } });
  const range = fit?.sessionRange ?? [0, 0] as const;
  const clampSession = (value: number) => Math.round(Math.max(range[0], Math.min(range[1], value)));
  const saveSession = (value: number) => layout.set({ sessionWidth: clampSession(value) });
  const sessionSplitter = useSplitter("x", fit?.session ?? 0, saveSession, saveSession, clampSession, { invert: true });
  return { fit, sessionSplitter };
}
