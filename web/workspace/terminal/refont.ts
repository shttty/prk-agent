import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import { fitTerminal } from "./fit-terminal.ts";

export function refont(terminal: Terminal, fitter: FitAddon, stack: string) {
  terminal.options.fontFamily = "monospace";
  terminal.options.fontFamily = stack;
  fitTerminal(terminal.element?.parentElement, fitter);
}
