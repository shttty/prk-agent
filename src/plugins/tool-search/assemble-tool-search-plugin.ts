import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { ToolDiscovery } from "../../sessions/tool-declarations/discovery-types.ts";
import { createDiscoveryTools } from "./create-discovery-tools.ts";
import { renderToolCatalog } from "./prompt/render.ts";

export function assembleToolSearchPlugin(discovery?: ToolDiscovery): ExtensionFactory {
  return (pi) => {
    for (const tool of createDiscoveryTools(discovery)) pi.registerTool(tool);
    if (!discovery) return;
    pi.on("context_with_system", (event) => {
      const content = renderToolCatalog(discovery.declarations());
      return { messages: event.messages.map((message) => message.role !== "system" ? message : {
        ...message, sections: { ...message.sections, tool_catalog: content ? `<tool_catalog>\n${content}\n</tool_catalog>` : null },
      }) };
    });
  };
}
