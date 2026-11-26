import { ANY, NEVER, NONE } from "./builtin-types.ts";
import type { LiteralValue, PythonType } from "./stub-types.ts";

const isLiteralValue = (value: unknown): value is LiteralValue => typeof value === "string" || typeof value === "boolean" || value === null || Number.isSafeInteger(value);

/** `Literal[...]` of an enum or const; Any when a value is not a str, int, bool or None (a float, an object), because Python's Literal cannot hold it. */
export function literalType(values: readonly unknown[]): PythonType {
  const unique = [...new Set(values)];
  if (unique.length === 0) return NEVER;
  if (!unique.every(isLiteralValue)) return ANY;
  return unique.length === 1 && unique[0] === null ? NONE : { kind: "literal", values: unique };
}
