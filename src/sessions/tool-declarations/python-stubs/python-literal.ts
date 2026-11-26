import type { LiteralValue } from "./stub-types.ts";

/** A literal as Python's repr() writes it: single-quoted strings unless they contain a single quote and no double quote. */
export function pythonLiteral(value: LiteralValue): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
  let text = "";
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (char === quote || char === "\\") text += `\\${char}`;
    else if (char === "\n") text += "\\n";
    else if (char === "\r") text += "\\r";
    else if (char === "\t") text += "\\t";
    else if (code < 0x20 || code === 0x7f) text += `\\x${code.toString(16).padStart(2, "0")}`;
    else if (code === 0x2028 || code === 0x2029) text += `\\u${code.toString(16)}`;
    else text += char;
  }
  return `${quote}${text}${quote}`;
}
