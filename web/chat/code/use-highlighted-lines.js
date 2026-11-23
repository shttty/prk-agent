import { useState } from "react";
import { useEffect } from "react";
export const cache = new Map();

export const CACHE_LIMIT = 48;

/** Per-line `[text, className]` segments for `code`, or null until the lazy highlighter has answered (or has no grammar). Nothing loads while `active` is false (collapsed rows). */
export function useHighlightedLines(code, query, active) {
  const key = query && code ? `${query.name || ""}\u0000${query.filename || ""}\u0000${code}` : null;
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!active || !key || cache.has(key)) return undefined;
    let live = true;
    import("./highlight-lines.js")
      .then((module) => module.highlightLines(code, query))
      .then((lines) => {
        if (!lines) return;
        if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
        cache.set(key, lines);
        if (live) rerender((count) => count + 1);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [active, code, key, query]);
  return key ? cache.get(key) ?? null : null;
}
