// Copied from @earendil-works/pi-coding-agent 1.6.0 dist/extensions/tool-search/tool.js (normalizeName, isExactNameQuery, indexDocument, Bm25Ranker), without the namespace
// field. See tokenize.ts for the upgrade check.
import type { ToolSearchDocument } from "./create-search-document.ts";
import { tokenize } from "./tokenize.ts";

/** Lowercase with characters invalid in script identifiers as `_`, so `dev-radius` matches `dev_radius`. */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_$]/gu, "_");
}

/** Whether the whole query is the tool's name: its full name or a suffix after a `__` separator. */
function isExactNameQuery(query: string, name: string): boolean {
  const normalized = normalizeName(name);
  return normalized === query || normalized.endsWith(`__${query}`);
}

function indexDocument(document: ToolSearchDocument) {
  const textCounts = new Map<string, number>();
  for (const term of tokenize(document.text)) textCounts.set(term, (textCounts.get(term) ?? 0) + 1);
  const segments = document.name.split("__");
  return {
    name: document.name,
    nameTerms: new Set(tokenize(document.name)),
    localNameTerms: [...new Set(tokenize(segments[segments.length - 1]!))],
    textCounts,
    textLength: [...textCounts.values()].reduce((sum, count) => sum + count, 0),
  };
}

/** A query term in the name counts this many times its IDF: a name match beats any number of mentions in the description. */
const NAME_WEIGHT = 3;

/**
 * Okapi BM25 over the description, with the name as a separate field:
 * - a tool that matches more of the query's terms ranks above one that matches fewer, whatever their scores;
 * - a query term in the name scores more than any number of mentions in the description;
 * - a tool whose whole local name is in the query gets a bonus worth one more match of every query term;
 * - a query that is exactly a tool's name ranks that tool first, before coverage.
 * The description alone is length-normalized. Ties keep document order.
 */
export class Bm25Ranker {
  private readonly k1: number;
  private readonly b: number;

  constructor(options: { k1?: number; b?: number } = {}) {
    this.k1 = options.k1 ?? 1.2;
    this.b = options.b ?? 0.75;
  }

  rank(query: string, documents: readonly ToolSearchDocument[], limit: number): { name: string; score: number }[] {
    const queryTerms = new Set(tokenize(query));
    if (queryTerms.size === 0 || documents.length === 0 || limit <= 0) return [];
    const indexed = documents.map(indexDocument);
    const averageLength = indexed.reduce((sum, document) => sum + document.textLength, 0) / indexed.length || 1;
    const idf = new Map([...queryTerms].map((term) => {
      const frequency = indexed.filter((document) => document.nameTerms.has(term) || document.textCounts.has(term)).length;
      return [term, Math.log(1 + (indexed.length - frequency + 0.5) / (frequency + 0.5))] as const;
    }));
    const fullNameBonus = [...idf.values()].reduce((sum, value) => sum + value, 0);
    const exactQuery = normalizeName(query);
    const matches: { name: string; score: number; covered: number; exact: boolean }[] = [];
    for (const document of indexed) {
      const norm = this.k1 * (1 - this.b + (this.b * document.textLength) / averageLength);
      let score = 0;
      let covered = 0;
      for (const term of queryTerms) {
        const count = document.textCounts.get(term) ?? 0;
        const weight = (document.nameTerms.has(term) ? NAME_WEIGHT : 0) + (count * (this.k1 + 1)) / (count + norm);
        if (weight > 0) covered++;
        score += (idf.get(term) ?? 0) * weight;
      }
      if (score === 0) continue;
      const local = document.localNameTerms;
      if (local.length > 0 && local.every((term) => queryTerms.has(term))) score += fullNameBonus;
      matches.push({ name: document.name, score, covered, exact: isExactNameQuery(exactQuery, document.name) });
    }
    return matches
      .sort((a, b) => Number(b.exact) - Number(a.exact) || b.covered - a.covered || b.score - a.score)
      .slice(0, limit)
      .map(({ name, score }) => ({ name, score }));
  }
}
