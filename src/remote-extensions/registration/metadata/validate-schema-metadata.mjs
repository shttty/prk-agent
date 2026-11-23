import { jsonMetadata } from "./validate-json-metadata.mjs";
import { check } from "./check-schema-node.mjs";

export function schemaMetadata(value, label) {
  const schema = jsonMetadata(value, label);
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) throw new TypeError(`${label} must be a JSON Schema object`);
  check(schema, label);
  return schema;
}
