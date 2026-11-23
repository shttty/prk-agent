import assert from "node:assert/strict";

export function readCallableNames(prompt) {
  const heading = "Currently callable Gateway tools:\n";
  const start = prompt.indexOf(heading);
  assert.notEqual(start, -1, "The actual provider prompt must contain the callable catalog");
  const names = [];
  for (const line of prompt.slice(start + heading.length).split("\n")) {
    const entry = /^([^\s:]+):\s/u.exec(line);
    if (!entry) break;
    names.push(entry[1]);
  }
  assert(names.length > 0, "The provider callable catalog must have tool entries");
  return names;
}
