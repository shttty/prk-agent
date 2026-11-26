import { createAskTool } from "../../../src/plugins/ask/tools/create-tool.ts";
import { createTerminalTools } from "../../../src/plugins/terminals/tools/create-tools.ts";
import { createDiscoveryTools } from "../../../src/plugins/tool-search/create-discovery-tools.ts";
import { createMessagingTools } from "../../../src/plugins/sessions/tools/create-messaging-tools.ts";
import { createManageTool } from "../../../src/plugins/sessions/tools/manage-session.ts";
import { createSpawnTool } from "../../../src/plugins/sessions/tools/spawn.ts";
import { createResultTool } from "../../../src/plugins/sessions/tools/submit-result.ts";

// Tool definitions are built, not executed, so a gateway that answers every property with another stub is enough.
const gateway = () => new Proxy(function () {}, { get: (_target, key) => (key === Symbol.toPrimitive ? () => "stub" : gateway()), apply: () => gateway() });

/** The tool definitions of this repository that can be created without a running session: their name, description, parameters and outputSchema. */
export function collectBuiltinTools() {
  return [
    createAskTool({}), ...createTerminalTools(() => ({})), ...createDiscoveryTools(undefined),
    ...createMessagingTools(gateway()), createManageTool(gateway()), createSpawnTool(gateway()), createResultTool(gateway()),
  ].map(({ name, description, parameters, outputSchema }) => JSON.parse(JSON.stringify({ name, description, parameters, outputSchema })));
}
