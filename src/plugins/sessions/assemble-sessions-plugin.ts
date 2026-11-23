import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { DelegationLevel } from "../../config/session/delegation-levels.ts";
import type { SessionsGateway } from "./gateway-types.ts";
import { renderSessions } from "./prompt/render.ts";
import { createSpawnTool } from "./tools/spawn.ts";
import { createResultTool } from "./tools/submit-result.ts";
import { createManageTool } from "./tools/manage-session.ts";
import { createMessagingTools } from "./tools/create-messaging-tools.ts";
import { createSpaceStatusTool } from "./space-status/create-space-status-tool.ts";

export function assembleSessionsPlugin(gateway: SessionsGateway | undefined, runtime: {
  enabled(): boolean;
  callableTools(): readonly string[];
  delegation(): DelegationLevel;
  flushInbox(): Promise<void> | undefined;
}): ExtensionFactory {
  return (pi) => {
    if (gateway) {
      for (const tool of [createSpaceStatusTool(gateway), createSpawnTool(gateway), createResultTool(gateway), createManageTool(gateway), ...createMessagingTools(gateway)]) pi.registerTool(tool);
    }
    pi.on("turn_end", () => runtime.flushInbox());
    pi.on("context_with_system", (event) => {
      const content = runtime.enabled() ? renderSessions(gateway?.identity(), runtime.delegation(), runtime.callableTools()) : "";
      return { messages: event.messages.map((message) => message.role !== "system" ? message : {
        ...message, sections: { ...message.sections, sessions: content ? `<sessions>\n${content}\n</sessions>` : null },
      }) };
    });
  };
}
