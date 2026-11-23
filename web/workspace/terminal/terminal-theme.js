import { fitTerminal } from "./fit-terminal.js";

export function refont(terminal, fitter, stack) {
  terminal.options.fontFamily = "monospace";
  terminal.options.fontFamily = stack;
  fitTerminal(terminal.element?.parentElement, fitter);
}

export const css = (element, name) => getComputedStyle(element).getPropertyValue(name).trim();

export const themeFrom = (element) => ({
  background: css(element, "--pi-code-bg"),
  foreground: css(element, "--pi-code-ink"),
  cursor: css(element, "--pi-accent"),
  cursorAccent: css(element, "--pi-code-bg"),
  selectionBackground: css(element, "--pi-term-selection"),
  selectionInactiveBackground: css(element, "--pi-term-selection-inactive"),
});
