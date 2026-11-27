// JSON Schema patterns are ECMAScript regexes: without the m flag `$` matches only the true string end. No lookaround: model providers reject it in tool schemas.
export const SKILL_SCOPE_PATTERN = "^(?:global|(?:instance|project):[^\\u0000-\\u001f\\u007f-\\u009f]+)$";
export const skillScopePattern = new RegExp(SKILL_SCOPE_PATTERN, "u");
