
// A config file without semantics: one section per JSON object (top-level values first), a field per value by its type.
export function rawSections(values, secrets) {
  const sections = [];
  const walk = (object, prefix) => {
    const fields = [], nested = [];
    for (const [name, value] of Object.entries(object)) {
      const key = prefix ? `${prefix}.${name}` : name;
      if (value && typeof value === "object" && !Array.isArray(value)) { nested.push([key, value]); continue; }
      const primitives = Array.isArray(value) && value.every((item) => ["string", "number", "boolean"].includes(typeof item));
      const type = Array.isArray(value) ? (primitives ? "list" : "json") : value === null ? "json" : typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "string";
      fields.push({ key, label: name, type, secret: secrets.includes(key), ...(type === "list" && typeof value[0] === "number" ? { itemType: "number" } : {}) });
    }
    if (fields.length) sections.push({ title: prefix, fields });
    for (const [key, value] of nested) walk(value, key);
  };
  walk(values, "");
  return sections;
}
