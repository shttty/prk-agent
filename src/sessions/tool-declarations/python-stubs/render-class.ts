import { fieldComments } from "./field-comments.ts";
import { isPythonName } from "./is-python-name.ts";
import { printType } from "./print-type.ts";
import { pythonLiteral } from "./python-literal.ts";
import type { PythonObject } from "./stub-types.ts";

/** A TypedDict definition. Keys that are not Python names (`max-results`, `from`) need the functional syntax. */
export function renderClass(object: PythonObject): string {
  const functional = object.fields.some(({ key }) => !isPythonName(key));
  const body = object.fields.flatMap((field) => {
    const type = field.optional ? `NotRequired[${printType(field.type)}]` : printType(field.type);
    return [...fieldComments(field).map((line) => `    # ${line}`), functional ? `    ${pythonLiteral(field.key)}: ${type},` : `    ${field.key}: ${type}`];
  });
  if (functional) return [`${object.name} = TypedDict(${pythonLiteral(object.name)}, {`, ...body, "})"].join("\n");
  return [`class ${object.name}(TypedDict):`, ...(body.length > 0 ? body : ["    ..."])].join("\n");
}
