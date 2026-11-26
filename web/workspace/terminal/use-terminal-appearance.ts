import type { RefObject } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { useEffect } from "react";
import { useComputedColorScheme } from "@mantine/core";
import { useThemeLibrary } from "../../design-system/theme/use-theme-library.ts";
import { css } from "./read-css.ts";
import { themeFrom } from "./theme-from.ts";
import { refont } from "./refont.ts";
import { fitTerminal } from "./fit-terminal.ts";

type TerminalAppearance = { host: RefObject<HTMLDivElement | null>; term: RefObject<Terminal | null>; fit: RefObject<FitAddon | null>; active: boolean; fontSize: number; cursorBlink: boolean };

/** How one xterm looks and fits: colours follow the page theme, fonts are re-measured when they load, the font size
 * follows the saved one (`fontSize`), the terminal refits when its host resizes while its tab is the shown one (`active`).
 * Independent of the socket.
 * Colours and font come from the page's CSS variables, which only resolve while the host is in the document: a shell tab
 * that was never shown (restored in the background) mounts outside it (see TERMINAL_RENDERER), so both are read when the
 * tab is shown. */
export function useTerminalAppearance({ host, term, fit, active, fontSize, cursorBlink }: TerminalAppearance) {
  const scheme = useComputedColorScheme("light");
  const selectedTheme = useThemeLibrary()?.selected;
  useEffect(() => { if (active && term.current && host.current?.isConnected) term.current.options.theme = themeFrom(host.current); }, [host, term, scheme, selectedTheme, active]);

  useEffect(() => { if (term.current) term.current.options.cursorBlink = cursorBlink; }, [term, cursorBlink]);

  // A new size refits the shown terminal at once; xterm's resize event then sends the new rows/cols to the PTY. A
  // background tab takes the size now and fits when it is shown.
  useEffect(() => {
    const terminal = term.current;
    if (!terminal || terminal.options.fontSize === fontSize) return;
    terminal.options.fontSize = fontSize;
    if (active && fit.current && host.current?.isConnected) fitTerminal(host.current, fit.current);
  }, [host, term, fit, active, fontSize]);

  // Maple Mono CN splits ASCII across two unicode-range slices (U+20-4A,U+6F with "0"/"o" and U+4B-6E,U+70-7E with "W"
  // and most of a-z) in both Regular and Bold. Preload both and re-measure on every font load so xterm's WidthCache
  // never keeps fallback glyph widths or inline letter-spacing.
  useEffect(() => {
    const element = host.current;
    if (!active || !element?.isConnected) return undefined;
    let stale = false;
    const stack = css(element, "--pi-font-mono");
    const remeasure = () => { if (!stale && term.current && fit.current) refont(term.current, fit.current, stack); };
    document.fonts.addEventListener("loadingdone", remeasure);
    void Promise.all([
      document.fonts.load(`13px ${stack}`, "0W"),
      document.fonts.load(`700 13px ${stack}`, "0W"),
      document.fonts.ready,
    ]).then(remeasure, () => {});
    return () => {
      stale = true;
      document.fonts.removeEventListener("loadingdone", remeasure);
    };
  }, [host, term, fit, active]);

  // While the tab is the shown one: the host (`.pi-term-host`, inside its own dock group since TERMINAL_RENDERER) is observed,
  // and every size it takes is fitted; xterm's own resize event then sends the new rows/cols to the PTY (use-terminal-session).
  // It is also fitted at once when the tab is shown again and when the page becomes visible again, so a size the host took
  // while hidden is never left to a later resize.
  useEffect(() => {
    const element = host.current;
    if (!element || !active) return undefined;
    const refit = () => { if (fit.current) fitTerminal(element, fit.current); };
    const observer = new ResizeObserver(refit);
    observer.observe(element);
    const shown = () => { if (document.visibilityState === "visible") refit(); };
    document.addEventListener("visibilitychange", shown);
    refit();
    term.current?.focus();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", shown); };
  }, [host, term, fit, active]);
}
