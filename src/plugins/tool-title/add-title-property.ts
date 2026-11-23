import { TITLE_FIELD, TITLE_PROPERTY } from "./title-field.ts";

type Schema = Record<string, unknown>;

function addToObject(schema: Schema): Schema | undefined {
  if (schema.type !== "object") return undefined;
  const properties = schema.properties ?? {};
  if (!properties || typeof properties !== "object" || Array.isArray(properties) || Object.hasOwn(properties, TITLE_FIELD)) return undefined;
  const required = Array.isArray(schema.required) ? schema.required : [];
  // First, so models write the title before the payload.
  return { ...schema, properties: { [TITLE_FIELD]: TITLE_PROPERTY, ...properties }, required: [TITLE_FIELD, ...required] };
}

/**
 * The parameter schema with a required title property: a plain object schema, or a root anyOf/oneOf (nested too)
 * whose every branch is one. Undefined when the tool cannot take it (another shape, or its own argument of that name).
 */
export function addTitleProperty(parameters: unknown): Schema | undefined {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return undefined;
  const schema = parameters as Schema;
  for (const key of ["anyOf", "oneOf"] as const) {
    const branches = schema[key];
    if (!Array.isArray(branches)) continue;
    const added = branches.map(addTitleProperty);
    return added.length && added.every(Boolean) ? { ...schema, [key]: added } : undefined;
  }
  return addToObject(schema);
}
