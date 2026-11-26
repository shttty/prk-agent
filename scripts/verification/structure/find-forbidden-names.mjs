const FORBIDDEN = new Set(["utils", "helpers", "common", "misc", "lib", "core", "base", "impl", "manager"]);

// A name breaks the rule when the forbidden word is the whole name or its trailing role word (`session-manager`,
// `string-utils`, `Utils.js`). A forbidden word that starts or sits inside a domain compound passes (`base-name`).
function breaksRule(segment) {
  const words = segment.split(/[-_.]/).flatMap((part) => part.match(/[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g) ?? []).map((word) => word.toLowerCase());
  const last = words.at(-1);
  return last !== undefined && FORBIDDEN.has(last);
}

/** Path segments (directories and the file stem) that use a forbidden generic name. */
export function findForbiddenNames(path) {
  const segments = path.split("/");
  const stem = segments.pop().replace(/\.(?:test\.|d\.)?[a-z]+$/, "");
  return [...segments, stem].filter(breaksRule);
}
