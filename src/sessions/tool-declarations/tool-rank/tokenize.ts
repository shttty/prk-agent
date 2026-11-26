// Copied from @earendil-works/pi-coding-agent 1.6.0 dist/extensions/tool-search/tool.js (STOP_WORDS, stem, tokenize); the package does not export it.
// On every Pi upgrade, diff this file, create-search-document.ts and bm25-ranker.ts against that file; test/unit/session/tool-rank.test.mjs compares rankings.
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });
const STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "with"]);

/** Naive singular form, so `issues` matches `issue` and `searches` matches `search`. */
function stem(term: string): string {
  if (term.length > 4 && term.endsWith("ies")) return `${term.slice(0, -3)}y`;
  if (term.length > 4 && /(ches|shes|sses|xes|zes)$/u.test(term)) return term.slice(0, -2);
  if (term.length > 3 && term.endsWith("s") && !term.endsWith("ss")) return term.slice(0, -1);
  return term;
}

/** Unicode word segmentation with identifier boundaries and English stop words/singular forms. */
export function tokenize(text: string): string[] {
  const normalized = text
    .normalize("NFC")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ");
  // The segmenter costs about 15 times a split; plain ASCII splits into the same words at spaces.
  const words = /^[a-z0-9 ]*$/u.test(normalized)
    ? normalized.split(" ")
    : Array.from(wordSegmenter.segment(normalized), (segment) => (segment.isWordLike ? segment.segment : ""));
  return words.filter((word) => word.length > 0 && !STOP_WORDS.has(word)).map((word) => (/^[a-z0-9]+$/u.test(word) ? stem(word) : word));
}
