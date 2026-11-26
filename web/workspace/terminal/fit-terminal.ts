import type { FitAddon } from "@xterm/addon-fit";
import { measurable } from "./measurable.ts";

/** Fit xterm to its host, but only while the host can be measured; otherwise keep the last size. */
export function fitTerminal(element: HTMLElement | null | undefined, fitter: FitAddon) {
  if (!measurable(element)) return;
  try { fitter.fit(); } catch { /* not laid out */ }
}
