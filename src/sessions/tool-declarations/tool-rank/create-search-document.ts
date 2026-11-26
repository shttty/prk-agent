// Copied from @earendil-works/pi-coding-agent 1.6.0 dist/extensions/tool-search/tool.js (schemaText, createToolSearchDocument), without the MCP namespace part:
// PRK tools have no namespace text. See tokenize.ts for the upgrade check.
import { resolveSchemaRef } from "@earendil-works/pi-codemode/declarations";
import { isSchemaObject } from "../python-stubs/is-schema-object.ts";

export interface ToolSearchDocument {
  readonly name: string;
  readonly text: string;
}

/** Schema descriptions and property names, recursively, following local `$ref`s into `root`; each referenced subschema is read once. */
function schemaText(schema: unknown, root: unknown, parts: string[], seen: Set<unknown>): void {
  if (!isSchemaObject(schema)) return;
  if (typeof schema.$ref === "string") {
    const target = resolveSchemaRef(schema.$ref, root);
    if (isSchemaObject(target) && !seen.has(target)) {
      seen.add(target);
      schemaText(target, root, parts, seen);
    }
  }
  if (typeof schema.description === "string") parts.push(schema.description);
  if (isSchemaObject(schema.properties)) {
    for (const [name, property] of Object.entries(schema.properties)) {
      parts.push(name);
      schemaText(property, root, parts, seen);
    }
  }
  schemaText(schema.items, root, parts, seen);
  for (const key of ["anyOf", "oneOf", "allOf"]) {
    const variants = schema[key];
    if (Array.isArray(variants)) for (const variant of variants) schemaText(variant, root, parts, seen);
  }
}

/** Search text of a tool: its description and the schema descriptions and property names. The ranker reads the name from `name`. */
export function createToolSearchDocument(tool: { name: string; description: string; parameters?: unknown }): ToolSearchDocument {
  const parts = [tool.description];
  schemaText(tool.parameters, tool.parameters, parts, new Set([tool.parameters]));
  return { name: tool.name, text: parts.filter((part) => part.trim()).join(" ") };
}
