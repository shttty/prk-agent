import type { Timer } from "../model-terminals-types.ts";

export function timer(callback: () => void, delay: number): Timer {
  const handle = setTimeout(callback, Math.max(0, delay));
  handle.unref();
  return handle;
}
