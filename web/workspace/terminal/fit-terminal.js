import { measurable } from "./measurable.js";

/** Fit xterm to its host, but only while the host can be measured; otherwise keep the last size. */
export function fitTerminal(element, fitter) {
  if (!measurable(element)) return;
  try { fitter.fit(); } catch { /* not laid out */ }
}
