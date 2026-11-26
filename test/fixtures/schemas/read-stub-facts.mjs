import { schemaType } from "../../../src/sessions/tool-declarations/python-stubs/schema-type.ts";

/** The same facts as read-pi-facts.mjs, read from the ported renderer's type tree: per property path, optional or not and the constraint tags. */
export function readStubFacts(schema, { tags = true } = {}) {
  const facts = new Map();
  const add = (path, fact) => facts.set(path, [...(facts.get(path) ?? []), JSON.stringify(fact)].sort());
  const walk = (type, path) => {
    if (type.kind === "list") walk(type.item, `${path}[]`);
    else if (type.kind === "tuple") type.items.forEach((item, index) => walk(item, `${path}[${index}]`));
    else if (type.kind === "union") type.items.forEach((item) => walk(item, path));
    else if (type.kind === "dict") walk(type.value, `${path}[*]`);
    else if (type.kind === "object") {
      for (const field of type.fields) {
        add(`${path}.${field.key}`, { optional: field.optional, tags: field.tags });
        walk(field.type, `${path}.${field.key}`);
      }
      if (type.extra) walk(type.extra, `${path}[*]`);
    }
  };
  walk(schemaType(schema, { root: schema, resolving: new Set(), names: new Set(), tags, stem: "T", expansions: 0 }, []), "");
  return facts;
}
