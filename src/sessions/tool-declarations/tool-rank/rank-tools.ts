import { Bm25Ranker } from "./bm25-ranker.ts";
import { createToolSearchDocument } from "./create-search-document.ts";

/** Pi's default result count for tool search. */
export const DEFAULT_SEARCH_LIMIT = 8;

/** The tools that match the query best (BM25 over name, description and argument names and descriptions), best first; tools that match no query term are left out. */
export function rankTools<T extends { name: string; description: string; parameters?: unknown }>(tools: readonly T[], query: string, limit: number = DEFAULT_SEARCH_LIMIT): T[] {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const ranked = new Bm25Ranker().rank(query, tools.map(createToolSearchDocument), limit);
  return ranked.map(({ name }) => byName.get(name)!);
}
