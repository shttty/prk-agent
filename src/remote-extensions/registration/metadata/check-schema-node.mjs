import { schemaTypes } from "../host-protocol.mjs";

export function check(item, label) {
  if (typeof item === "boolean") return;
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new TypeError(`${label} contains a non-schema value`);
  if (Object.hasOwn(item, "type") &&
      !(typeof item.type === "string" ? Object.hasOwn(schemaTypes, item.type) : Array.isArray(item.type) && item.type.length && item.type.every((type) => typeof type === "string" && Object.hasOwn(schemaTypes, type)))) {
    throw new TypeError(`${label} contains a non-JSON Schema type`);
  }
  for (const key of ["properties", "patternProperties", "$defs", "definitions", "dependentSchemas"]) {
    if (item[key] !== undefined) Object.values(item[key]).forEach((child) => check(child, label));
  }
  for (const key of ["allOf", "anyOf", "oneOf", "prefixItems"]) {
    if (item[key] !== undefined) {
      if (!Array.isArray(item[key])) throw new TypeError(`${label}.${key} must be an array`);
      item[key].forEach((child) => check(child, label));
    }
  }
  for (const key of ["items", "additionalItems", "additionalProperties", "unevaluatedItems", "unevaluatedProperties", "propertyNames", "contains", "not", "if", "then", "else", "contentSchema"]) {
    if (item[key] !== undefined) Array.isArray(item[key]) ? item[key].forEach((child) => check(child, label)) : check(item[key], label);
  }
  if (item.dependencies) for (const dependency of Object.values(item.dependencies)) if (!Array.isArray(dependency)) check(dependency, label);
}
