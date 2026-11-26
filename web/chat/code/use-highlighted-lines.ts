import { useState } from "react";
import { useEffect } from "react";
import type { HighlightedLines, HighlightQuery } from "./code-types.ts";
export const cache = new Map<string, HighlightedLines>();

export const CACHE_LIMIT = 48;

/** Per-line `[text, className]` segments for `code`, or null until the lazy highlighter has answered (or has no grammar). Nothing loads while `active` is false (collapsed rows). */
export function useHighlightedLines(code: string, query: HighlightQuery | null | undefined, active: boolean): HighlightedLines | null {
  const key = query && code ? `${query.name || ""}\u0000${query.filename || ""}\u0000${code}` : null;
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!active || !key || cache.has(key)) return undefined;
    let live = true;
    import("./highlight-lines.ts")
      .then((module) => module.highlightLines(code, query ?? {}))
      .then((lines) => {
        if (!lines) return;
        if (cache.size >= CACHE_LIMIT) for (const oldest of cache.keys()) { cache.delete(oldest); break; }
        cache.set(key, lines);
        if (live) rerender((count) => count + 1);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [active, code, key, query]);
  return key ? cache.get(key) ?? null : null;
}
