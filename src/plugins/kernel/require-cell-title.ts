import type { Tool } from "@earendil-works/pi-ai";
import { TITLE_FIELD, TITLE_PROPERTY } from "../tool-title/title-field.ts";
import { CELL_TITLE_HINT } from "./create-kernel-tool-definition.ts";

/** With tool titles on, the cell title is the call title: required, first, described like every other tool's. */
export function requireCellTitle(tool: Tool): Tool {
  const schema = tool.parameters as unknown as { properties: Record<string, unknown>; required?: string[] };
  const { [TITLE_FIELD]: _own, ...properties } = schema.properties;
  return {
    ...tool,
    description: tool.description.replace(` ${CELL_TITLE_HINT}`, ""),
    parameters: { ...schema, properties: { [TITLE_FIELD]: TITLE_PROPERTY, ...properties },
      required: [TITLE_FIELD, ...(schema.required ?? []).filter((name) => name !== TITLE_FIELD)] } as unknown as Tool["parameters"],
  };
}
