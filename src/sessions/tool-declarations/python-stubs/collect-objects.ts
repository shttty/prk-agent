import type { PythonObject, PythonType } from "./stub-types.ts";

/** Every object that needs a class definition, found in the type: objects with unnamed keys print as dicts, so only their extra type is searched. */
export function collectObjects(type: PythonType, found: Map<string, PythonObject> = new Map()): Map<string, PythonObject> {
  switch (type.kind) {
    case "object":
      if (type.extra) collectObjects(type.extra, found);
      else {
        found.set(type.name, type);
        for (const field of type.fields) collectObjects(field.type, found);
      }
      break;
    case "list": collectObjects(type.item, found); break;
    case "dict": collectObjects(type.value, found); break;
    case "tuple":
    case "union": for (const item of type.items) collectObjects(item, found); break;
  }
  return found;
}
