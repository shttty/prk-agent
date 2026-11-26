// Ported from @earendil-works/pi-codemode 1.6.0 dist/declarations.js (toType, arrayType): the same cases in the same order, with Python types as the
// output. Re-check it against Pi on upgrade; test/unit/session/schema-parity.test.mjs compares the two.
import { ANY, NEVER, NONE } from "./builtin-types.ts";
import { expandRef } from "./expand-ref.ts";
import { isSchemaObject, type SchemaObject } from "./is-schema-object.ts";
import { literalType } from "./literal-type.ts";
import { mergeAllOf } from "./merge-all-of.ts";
import { objectType } from "./object-type.ts";
import type { PythonType, StubContext } from "./stub-types.ts";
import { unionType } from "./union-type.ts";

const named = (text: string): PythonType => ({ kind: "name", text });

/**
 * The Python type of a JSON Schema. `path` names the TypedDicts generated for inline objects below this schema.
 * Recursive and remote references, and anything the schema does not say, are Any.
 */
export function schemaType(schema: unknown, ctx: StubContext, path: readonly string[]): PythonType {
  if (schema === true) return ANY;
  if (schema === false) return NEVER;
  if (!isSchemaObject(schema)) return ANY;
  if (typeof schema.$ref === "string") {
    const ref = schema.$ref;
    const target = expandRef(ref, ctx);
    if (target === undefined) return ANY;
    ctx.resolving.add(ref);
    try { return schemaType(target, ctx, path); } finally { ctx.resolving.delete(ref); }
  }
  if ("const" in schema) return literalType([schema.const]);
  if (Array.isArray(schema.enum)) return literalType(schema.enum);
  const variants = Array.isArray(schema.anyOf) ? schema.anyOf : Array.isArray(schema.oneOf) ? schema.oneOf : undefined;
  if (variants) {
    // `X | None` keeps the path of X; several real alternatives are told apart by position.
    const single = variants.filter((variant) => !(isSchemaObject(variant) && variant.type === "null")).length <= 1;
    return unionType(variants.map((variant, index) => schemaType(variant, ctx, single ? path : [...path, `Variant${index + 1}`])));
  }
  if (Array.isArray(schema.allOf)) {
    const merged = mergeAllOf(schema.allOf, ctx);
    return merged ? objectType(merged, ctx, path, (child, childPath) => schemaType(child, ctx, childPath)) : ANY;
  }
  const type = schema.type;
  if (Array.isArray(type)) return unionType(type.map((entry) => schemaType({ ...schema, type: entry }, ctx, path)));
  switch (type) {
    case "string": return named("str");
    case "number": return named("float");
    case "integer": return named("int");
    case "boolean": return named("bool");
    case "null": return NONE;
    case "array": return arrayType(schema, ctx, path);
    case "object": return objectType(schema, ctx, path, (child, childPath) => schemaType(child, ctx, childPath));
    case undefined:
      if ("properties" in schema || "additionalProperties" in schema || "required" in schema) return objectType(schema, ctx, path, (child, childPath) => schemaType(child, ctx, childPath));
      return "items" in schema || "prefixItems" in schema ? arrayType(schema, ctx, path) : ANY;
    default: return ANY;
  }
}

function arrayType(schema: SchemaObject, ctx: StubContext, path: readonly string[]): PythonType {
  if (schema.items !== undefined && !Array.isArray(schema.items)) return { kind: "list", item: schemaType(schema.items, ctx, [...path, "Item"]) };
  const tuple = Array.isArray(schema.prefixItems) ? schema.prefixItems : Array.isArray(schema.items) ? schema.items : [];
  if (tuple.length > 0) return { kind: "tuple", items: tuple.map((item, index) => schemaType(item, ctx, [...path, `Item${index + 1}`])) };
  return { kind: "list", item: ANY };
}
