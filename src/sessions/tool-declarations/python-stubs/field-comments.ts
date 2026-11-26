import type { PythonField } from "./stub-types.ts";
import { typeNotes } from "./type-notes.ts";

/** The comment lines above a field or parameter: its description, then its constraint tags, then notes about its type. */
export function fieldComments(field: PythonField): string[] {
  return [...field.description, ...(field.tags ? [field.tags] : []), ...typeNotes(field.type)];
}
