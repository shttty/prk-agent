import { countExportedFunctions } from "./count-exported-functions.mjs";
import { findForbiddenNames } from "./find-forbidden-names.mjs";
import { readCodeLines } from "./read-code-lines.mjs";

export const MAX_CODE_LINES = 200;
const EXEMPT_FROM_EXPORT_RULE = /-(?:constants|schema|types)\.[^/]+$/;

/** Rules a source file breaks: "lines" (> 200 effective), "exports" (>= 2 exported functions), "name" (forbidden word). */
export function findFileViolations(path, text) {
  const lines = readCodeLines(text);
  const rules = [];
  if (lines.length > MAX_CODE_LINES) rules.push("lines");
  if (!EXEMPT_FROM_EXPORT_RULE.test(path) && countExportedFunctions(lines) >= 2) rules.push("exports");
  if (findForbiddenNames(path).length > 0) rules.push("name");
  return rules;
}
