import type { KernelHelper } from "../../../../codemode/module-catalog/catalog-types.ts";

/** Python stubs of the offered functions: the TypedDicts they return, then the defs. Both are sorted by name, so the bytes depend only on the function set. */
export function renderStubs(helpers: readonly KernelHelper[]): string {
  const types = new Map<string, string>();
  for (const helper of helpers) for (const [name, text] of Object.entries(helper.types ?? {})) types.set(name, text);
  const defs = helpers.flatMap(({ name, stub }) => stub === undefined ? [] : [[name, stub] as const]);
  const byName = (a: readonly [string, string], b: readonly [string, string]) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return ["```python", ...[...types].sort(byName).map(([, text]) => text), ...defs.sort(byName).map(([, stub]) => stub), "```"].join("\n");
}
