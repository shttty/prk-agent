import { expandRef } from "./expand-ref.ts";
import { isSchemaObject, type SchemaObject } from "./is-schema-object.ts";
import type { StubContext } from "./stub-types.ts";

/**
 * One object schema from an `allOf` whose parts are all objects (directly, through local $refs or through nested allOf):
 * the properties and required names of every part. A property two parts define differently becomes unconstrained.
 * Undefined when a part is not an object.
 */
export function mergeAllOf(parts: readonly unknown[], ctx: StubContext): SchemaObject | undefined {
  const objects: SchemaObject[] = [];
  if (parts.length === 0 || !parts.every((part) => collect(part, ctx, objects))) return undefined;
  const properties: SchemaObject = {};
  const required = new Set<string>();
  let additional: unknown;
  for (const object of objects) {
    for (const [name, property] of Object.entries(isSchemaObject(object.properties) ? object.properties : {})) {
      properties[name] = Object.hasOwn(properties, name) && JSON.stringify(properties[name]) !== JSON.stringify(property) ? true : property;
    }
    for (const name of Array.isArray(object.required) ? object.required : []) if (typeof name === "string") required.add(name);
    // The first part that allows other keys decides their type; a closed part only counts when no part is open.
    const value = object.additionalProperties;
    if (value !== undefined && (additional === undefined || additional === false)) additional = value;
  }
  return { type: "object", properties, required: [...required], ...(additional === undefined ? {} : { additionalProperties: additional }) };
}

function collect(part: unknown, ctx: StubContext, objects: SchemaObject[]): boolean {
  if (!isSchemaObject(part)) return false;
  if (typeof part.$ref === "string") {
    const target = expandRef(part.$ref, ctx);
    return target !== undefined && collect(target, ctx, objects);
  }
  if (Array.isArray(part.allOf)) return part.allOf.every((nested) => collect(nested, ctx, objects));
  const open = part.type === undefined && ["properties", "additionalProperties", "required"].some((key) => key in part);
  if (part.type !== "object" && !open) return false;
  if (["enum", "const", "anyOf", "oneOf"].some((key) => key in part)) return false;
  objects.push(part);
  return true;
}
