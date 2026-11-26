import type { ConfigField, ConfigSection, ConfigValues, FieldType } from "./capability-types.ts";

// A config file without semantics: one section per JSON object (top-level values first), a field per value by its type.
export function rawSections(values: ConfigValues, secrets: string[]) {
  const sections: ConfigSection[] = [];
  const walk = (object: ConfigValues, prefix: string) => {
    const fields: ConfigField[] = [], nested: [string, ConfigValues][] = [];
    for (const [name, value] of Object.entries(object)) {
      const key = prefix ? `${prefix}.${name}` : name;
      if (value && typeof value === "object" && !Array.isArray(value)) { nested.push([key, Object.fromEntries(Object.entries(value))]); continue; }
      const primitives = Array.isArray(value) && value.every((item) => ["string", "number", "boolean"].includes(typeof item));
      const type: FieldType = Array.isArray(value) ? (primitives ? "list" : "json") : value === null ? "json" : typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "string";
      fields.push({ key, label: name, type, secret: secrets.includes(key), ...(type === "list" && Array.isArray(value) && typeof value[0] === "number" ? { itemType: "number" as const } : {}) });
    }
    if (fields.length) sections.push({ title: prefix, fields });
    for (const [key, value] of nested) walk(value, key);
  };
  walk(values, "");
  return sections;
}
