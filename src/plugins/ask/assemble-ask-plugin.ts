import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { AskEnvironment } from "./tools/ask-types.ts";
import { createAskTool } from "./tools/create-tool.ts";
import { renderAsk } from "./prompt/render.ts";

export function assembleAskPlugin(env: AskEnvironment, runtime: {
  enabled(): boolean;
  callableTools(): readonly string[];
}): ExtensionFactory {
  return (pi) => {
    pi.registerTool(createAskTool(env));
    pi.on("context_with_system", (event) => {
      const content = runtime.enabled() ? renderAsk(runtime.callableTools()) : "";
      return { messages: event.messages.map((message) => message.role !== "system" ? message : {
        ...message, sections: { ...message.sections, ask: content ? `<ask>\n${content}\n</ask>` : null },
      }) };
    });
  };
}
