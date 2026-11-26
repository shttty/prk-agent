import type { MessageChange, MessageText } from "./capture-types.ts";
import { withoutCacheMarker } from "./without-cache-marker.ts";

const WINDOW_CHARS = 2000;
const LEAD_CHARS = 200;

/** The first changed message of two requests as pretty JSON, both sides cut to one window that starts just before their first differing character. */
export function describeMessageChange(index: number, before: unknown, after: unknown): MessageChange {
  const a = pretty(before), b = pretty(after);
  const offset = a === null || b === null ? 0 : Math.max(0, firstDifference(a, b) - LEAD_CHARS);
  return { index, offset, before: window(a, offset), after: window(b, offset) };
}

function pretty(message: unknown): string | null { return message === undefined ? null : JSON.stringify(message, withoutCacheMarker, 2) ?? null; }
function window(text: string | null, offset: number): MessageText | null { return text === null ? null : { chars: text.length, text: text.slice(offset, offset + WINDOW_CHARS) }; }
function firstDifference(a: string, b: string): number {
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) at++;
  return at;
}
