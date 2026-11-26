import type { ToolStub } from "./render-tool-stub.ts";

const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The stubs as one block of Python: every TypedDict sorted by name, then every def sorted by name, so the bytes depend only on the set of tools.
 * A tool whose TypedDict name another tool already defined differently is left out (`dropped`): one name cannot mean two classes.
 */
export function mergeStubs(stubs: readonly ToolStub[]): { text: string; dropped: string[] } {
  const classes = new Map<string, string>();
  const kept: ToolStub[] = [];
  const dropped: string[] = [];
  for (const stub of [...stubs].sort((a, b) => byName(a.name, b.name))) {
    if ([...stub.classes].some(([name, text]) => classes.has(name) && classes.get(name) !== text)) dropped.push(stub.name);
    else {
      for (const [name, text] of stub.classes) classes.set(name, text);
      kept.push(stub);
    }
  }
  const text = [...[...classes].sort(([a], [b]) => byName(a, b)).map(([, definition]) => definition), ...kept.map(({ def }) => def)].join("\n");
  return { text, dropped };
}
