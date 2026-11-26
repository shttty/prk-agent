import type { DeclarationTool } from "../declaration-types.ts";
import { mergeStubs } from "../python-stubs/merge-stubs.ts";
import { renderToolStub } from "../python-stubs/render-tool-stub.ts";
import { stubCost } from "../python-stubs/stub-cost.ts";
import { selectCatalog } from "./select-catalog.ts";

export type CatalogTool = Pick<DeclarationTool, "name" | "description" | "parameters" | "outputSchema" | "promptGuidelines" | "exposure" | "lazy" | "group">;

const HEADER = "Currently callable Gateway tools:";
const FOOTER = "Tools not listed here (deferred, switched to lazy, or past the budget) are callable all the same: find them with gateway.search(query) or read a stub with gateway.describe(name).";

/**
 * The code-mode tool catalog: Python stubs of the callable tools that are not effectively deferred (exposure `deferred`, or the user's lazy switch on),
 * as many as the budget (estimated tokens) holds, then a line on how to find the rest. Like Pi's codemode description, each round places the cheapest remaining tool of
 * every group (the tool's settings group; tools without one first, then groups by name). Tools and groups are sorted by name, so the bytes depend only on the tool set.
 */
export function renderCodeCatalog(tools: readonly CatalogTool[], inlineBudget: number): { text: string; listed: string[] } {
  const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const stubs = tools.filter((tool) => tool.exposure !== "deferred" && !tool.lazy).sort((a, b) => byName(a.name, b.name))
    .map((tool) => ({ group: tool.group ?? "", stub: renderToolStub(tool, "summary") }));
  const groups = [...new Set(stubs.map(({ group }) => group))].sort(byName)
    .map((group) => ({ entries: stubs.filter((entry) => entry.group === group).map(({ stub }) => ({ name: stub.name, cost: stubCost(stub) })) }));
  const shown = selectCatalog(groups, inlineBudget);
  const { text, dropped } = mergeStubs(stubs.filter(({ stub }) => shown.has(stub.name)).map(({ stub }) => stub));
  const listed = stubs.map(({ stub }) => stub.name).filter((name) => shown.has(name) && !dropped.includes(name));
  return { text: [HEADER, ...(listed.length > 0 ? ["```python", text, "```"] : []), FOOTER].join("\n"), listed };
}
