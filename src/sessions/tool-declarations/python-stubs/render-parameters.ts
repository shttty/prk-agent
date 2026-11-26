import { fieldComments } from "./field-comments.ts";
import { isPythonName } from "./is-python-name.ts";
import { printType } from "./print-type.ts";
import { typeNotes } from "./type-notes.ts";
import type { PythonType } from "./stub-types.ts";

export interface ParameterLine {
  readonly comments: readonly string[];
  /** `name: T`, `name: T = ...` for an optional one, or `**name: T`. */
  readonly text: string;
}

/**
 * The parameters of `gateway.<tool>(**args)` for the type of the tool's arguments: an object's fields become keyword-only parameters
 * (`= ...` when optional) and its other keys `**extra`. A union of objects stays one `**args` parameter listing the shapes; so do arguments that are not an object or have
 * keys that are not Python names.
 * `referenced` are the types the lines print, whose TypedDicts the stub must define.
 */
export function renderParameters(type: PythonType): { lines: ParameterLine[]; referenced: PythonType[] } {
  if (type.kind === "dict") return { lines: [{ comments: [], text: `**kwargs: ${printType(type.value)}` }], referenced: [type.value] };
  if (type.kind === "union" && type.items.every((item) => item.kind === "object" && !item.extra)) {
    return { lines: [{ comments: ["keyword arguments of exactly one of these shapes"], text: `**args: ${printType(type)}` }], referenced: [type] };
  }
  if (type.kind !== "object") return { lines: [{ comments: [], text: "**args: Any" }], referenced: [] };
  if (!type.fields.every(({ key }) => isPythonName(key))) {
    return { lines: [{ comments: typeNotes(type), text: `**args: ${type.extra ? printType(type) : `Unpack[${type.name}]`}` }], referenced: [type] };
  }
  const fields = type.fields.map((field): ParameterLine => ({ comments: fieldComments(field), text: `${field.key}: ${printType(field.type)}${field.optional ? " = ..." : ""}` }));
  const lines = [
    ...(fields.length > 0 ? [{ comments: [], text: "*" }] : []), ...fields,
    ...(type.extra ? [{ comments: typeNotes(type.extra), text: `**extra: ${printType(type.extra)}` }] : []),
  ];
  return { lines, referenced: [...type.fields.map(({ type: field }) => field), ...(type.extra ? [type.extra] : [])] };
}
