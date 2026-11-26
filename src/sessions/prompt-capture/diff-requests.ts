import type { Change, Delta, PromptDiff, RecordedRequest, SizedSection } from "./capture-types.ts";

export function diffRequests(before: RecordedRequest, after: RecordedRequest): PromptDiff {
  const a = before.request, b = after.request, x = before.digest, y = after.digest;
  const tools = a.tools && b.tools ? {
    ...delta(sizes(a.tools.map((tool) => [tool.name, tool.descriptionChars + tool.parametersChars])), sizes(b.tools.map((tool) => [tool.name, tool.descriptionChars + tool.parametersChars])), x.tools!, y.tools!),
    reordered: inOrder(x.toolOrder, y.toolOrder).join("\0") !== inOrder(y.toolOrder, x.toolOrder).join("\0"),
  } : null;
  return {
    modelChanged: a.provider !== b.provider || a.model !== b.model,
    system: a.system && b.system ? { changed: x.system !== y.system, chars: { before: a.system.chars, after: b.system.chars } } : null,
    sections: a.system?.sections && b.system?.sections
      ? delta(sizes(a.system.sections.entries.map((entry) => [entry.key, entry.chars])), sizes(b.system.sections.entries.map((entry) => [entry.key, entry.chars])), x.sections!, y.sections!)
      : null,
    tools,
    messages: x.messages && y.messages ? messages(x.messages, y.messages) : null,
  };
}

function messages(before: readonly string[], after: readonly string[]): NonNullable<PromptDiff["messages"]> {
  let common = 0;
  while (common < before.length && common < after.length && before[common] === after[common]) common++;
  return { before: before.length, after: after.length, commonPrefix: common, prefixStable: common === before.length };
}

function delta(before: ReadonlyMap<string, number>, after: ReadonlyMap<string, number>, x: Readonly<Record<string, string>>, y: Readonly<Record<string, string>>): Delta {
  const entry = (map: ReadonlyMap<string, number>) => ([key]: readonly [string, unknown]): SizedSection => ({ key, chars: map.get(key)! });
  const changed: Change[] = [...after.keys()].filter((key) => before.has(key) && x[key] !== y[key]).map((key) => ({ key, before: before.get(key)!, after: after.get(key)! }));
  return {
    added: [...after].filter(([key]) => !before.has(key)).map(entry(after)),
    removed: [...before].filter(([key]) => !after.has(key)).map(entry(before)),
    changed,
  };
}

/** Names present in both lists, in the order of the first. */
function inOrder(list: readonly string[], other: readonly string[]): string[] { return list.filter((name) => other.includes(name)); }
function sizes(entries: readonly (readonly [string, number])[]): ReadonlyMap<string, number> { return new Map(entries); }
