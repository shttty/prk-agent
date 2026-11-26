import type { ITheme } from "@xterm/xterm";
import { css } from "./read-css.ts";

export const themeFrom = (element: Element): ITheme => ({
  background: css(element, "--pi-code-bg"),
  foreground: css(element, "--pi-code-ink"),
  cursor: css(element, "--pi-accent"),
  cursorAccent: css(element, "--pi-code-bg"),
  selectionBackground: css(element, "--pi-term-selection"),
  selectionInactiveBackground: css(element, "--pi-term-selection-inactive"),
});
