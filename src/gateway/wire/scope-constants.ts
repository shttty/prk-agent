// The final lookahead anchors the true string end, including trailing newlines.
export const SKILL_SCOPE_PATTERN = "^(?:global|(?:instance|project):[^\\u0000-\\u001f\\u007f-\\u009f]+)(?![\\s\\S])";
export const skillScopePattern = new RegExp(SKILL_SCOPE_PATTERN, "u");
