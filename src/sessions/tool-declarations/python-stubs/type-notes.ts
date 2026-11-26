import { printType } from "./print-type.ts";
import type { PythonType } from "./stub-types.ts";

/** Comment lines a type needs where it is used: an object that also takes unnamed keys prints as a dict, so its named keys go in a note. */
export function typeNotes(type: PythonType): string[] {
  switch (type.kind) {
    case "object": return type.extra ? [`fixed keys: ${type.fields.map(({ key, optional }) => `${key}${optional ? " (optional)" : ""}`).join(", ")}; other keys: ${printType(type.extra)}`] : [];
    case "list": return typeNotes(type.item);
    case "dict": return typeNotes(type.value);
    case "tuple":
    case "union": return type.items.flatMap(typeNotes);
    default: return [];
  }
}
