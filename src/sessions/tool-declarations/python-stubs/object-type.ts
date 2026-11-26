// Ported from @earendil-works/pi-codemode 1.6.0 dist/declarations.js (objectType, descriptionOf): properties sorted by name, descriptions and constraint tags
// as comments, an open object when nothing is declared. Re-check it against Pi on upgrade; test/unit/session/schema-parity.test.mjs compares the two.
import { ANY } from "./builtin-types.ts";
import { constraintTags } from "./constraint-tags.ts";
import { isSchemaObject, type SchemaObject } from "./is-schema-object.ts";
import { pascalCase } from "./pascal-case.ts";
import type { PythonField, PythonType, StubContext } from "./stub-types.ts";

const LINE_TERMINATORS = /[\r\n\u2028\u2029]/u;

/**
 * An object schema as a named TypedDict (`ctx.stem` plus the field path), a dict[str, T] when it names no field but allows other keys,
 * or a dict-like object that keeps its named fields beside `extra` when it declares both. `render` types a subschema at its path.
 */
export function objectType(schema: SchemaObject, ctx: StubContext, path: readonly string[], render: (schema: unknown, path: readonly string[]) => PythonType): PythonType {
  const properties = isSchemaObject(schema.properties) ? schema.properties : {};
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const names = Object.keys(properties).sort();
  const additional = schema.additionalProperties;
  if (names.length === 0 && additional !== false) return { kind: "dict", value: additional === undefined || additional === true ? ANY : render(additional, [...path, "Value"]) };
  const name = uniqueName(ctx, path);
  const fields = names.map((key): PythonField => ({
    key, optional: !required.has(key), type: render(properties[key], [...path, pascalCase(key) || "Field"]),
    description: descriptionLines(properties[key]), tags: ctx.tags ? constraintTags(properties[key]) : "",
  }));
  const extra = additional === undefined || additional === false ? undefined : additional === true ? ANY : render(additional, [...path, "Value"]);
  return { kind: "object", name, fields, ...(extra ? { extra } : {}) };
}

function uniqueName(ctx: StubContext, path: readonly string[]): string {
  const base = ctx.stem + path.join("");
  let name = base;
  for (let number = 2; ctx.names.has(name); number++) name = `${base}${number}`;
  ctx.names.add(name);
  return name;
}

function descriptionLines(property: unknown): string[] {
  const description = isSchemaObject(property) && typeof property.description === "string" ? property.description.trim() : "";
  return description.split(LINE_TERMINATORS).map((line) => line.trim()).filter(Boolean);
}
