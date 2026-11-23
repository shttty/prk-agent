import type { Tool } from "@earendil-works/pi-ai";
import { addTitleProperty } from "./add-title-property.ts";

/** The declaration with a required title argument, or unchanged when the tool cannot take one. */
export function declareTitle(tool: Tool): Tool {
  const parameters = addTitleProperty(tool.parameters);
  return parameters ? { ...tool, parameters: parameters as unknown as Tool["parameters"] } : tool;
}
