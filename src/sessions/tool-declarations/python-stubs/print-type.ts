import { pythonLiteral } from "./python-literal.ts";
import type { PythonType } from "./stub-types.ts";

/** A type as stub text. Objects print as their TypedDict name (render-class.ts writes the class), or as a plain dict when they take keys the schema does not name. */
export function printType(type: PythonType): string {
  switch (type.kind) {
    case "name": return type.text;
    case "literal": return `Literal[${type.values.map(pythonLiteral).join(", ")}]`;
    case "list": return `list[${printType(type.item)}]`;
    case "tuple": return `tuple[${type.items.map(printType).join(", ")}]`;
    case "dict": return `dict[str, ${printType(type.value)}]`;
    case "union": return type.items.map(printType).join(" | ");
    case "object": return type.extra ? "dict[str, Any]" : type.name;
  }
}
