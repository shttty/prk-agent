const KEYWORDS = new Set(["False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except",
  "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield"]);

/** Whether a property name can be written as a TypedDict field or a keyword parameter. */
export function isPythonName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) && !KEYWORDS.has(name);
}
