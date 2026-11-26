/**
 * Names a prompt mentions as something the model can call but that this turn does not offer.
 *
 * `known` is every callable name that could be mentioned (tools and kernel helpers); `available` is the subset the
 * session really offers. A snake_case name counts wherever it appears; a one-word name (read, bash) counts only as a
 * call `name(`, in backticks, or inside a slash list such as `grep/read/glob`, so ordinary prose does not match.
 */
export function findDanglingReferences(texts, { known, available }) {
  const found = new Map();
  for (const [source, text] of texts) {
    for (const [name, at] of mentions(text, known)) {
      if (!available.has(name) && !found.has(name)) found.set(name, { name, source, context: text.slice(Math.max(0, at - 50), at + name.length + 50).replace(/\s+/g, " ") });
    }
  }
  return [...found.values()];
}

/** Each mentioned known name with the offset of its first mention. */
function mentions(text, known) {
  const names = new Map();
  const add = (name, at) => { if (known.has(name) && !names.has(name)) names.set(name, at); };
  for (const { 0: token, index } of text.matchAll(/(?<![\w.])[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?![\w])/g)) add(token, index);
  for (const { 1: name, index } of text.matchAll(/(?<![\w.])(?:gateway\.)?([a-z][a-z0-9_]*)\(/g)) add(name, index);
  for (const { 1: name, index } of text.matchAll(/`([a-z][a-z0-9_]*)`/g)) add(name, index);
  for (const { 0: list, index } of text.matchAll(/(?<![\w/])[a-z][a-z0-9_]*(?:\/[a-z][a-z0-9_]*)+(?![\w/])/g)) {
    const parts = list.split("/");
    if (parts.every((part) => known.has(part))) for (const part of parts) add(part, index + list.indexOf(part));
  }
  return names;
}
