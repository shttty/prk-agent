import {
  createReadToolDefinition,
  createBashToolDefinition,
  createEditToolDefinition,
  createWriteToolDefinition,
  createGrepToolDefinition,
  createFindToolDefinition,
  createLsToolDefinition,
  defineTool,
} from "@earendil-works/pi-coding-agent";

/** Same-version definitions for cataloguing and native prepare/render restoration, not target execution. */
export function createNativeToolDefinitions(cwd: string) {
  return [
    defineTool(createReadToolDefinition(cwd)),
    defineTool(createBashToolDefinition(cwd)),
    defineTool(createEditToolDefinition(cwd)),
    defineTool(createWriteToolDefinition(cwd)),
    defineTool(createGrepToolDefinition(cwd)),
    defineTool(createFindToolDefinition(cwd)),
    defineTool(createLsToolDefinition(cwd)),
  ];
}
