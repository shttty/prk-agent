import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { addTitleProperty } from "./add-title-property.ts";
import { declareTitle } from "./declare-title.ts";
import { extractTitles } from "./extract-titles.ts";

/**
 * Tool titles: every declared tool gets a required title argument for the next request while `enabled()`;
 * message_end moves it onto the toolcall block before Pi validates or runs the call. Tools that declare their own
 * `title` (kernel_code) are left to their plugin and keep the argument.
 */
export function assembleToolTitlePlugin(enabled: () => boolean): ExtensionFactory {
  return (pi) => {
    pi.on("context_with_system", (event) => {
      if (!enabled()) return undefined;
      return { messages: event.messages.map((message) => message.role !== "system" || !message.toolsAdded?.length ? message
        : { ...message, toolsAdded: message.toolsAdded.map(declareTitle) }) };
    });
    pi.on("message_end", (event) => {
      if (event.message.role !== "assistant") return undefined;
      const tools = new Map(pi.getAllTools().map((tool) => [tool.name, tool.parameters]));
      const message = extractTitles(event.message, (name) => tools.has(name) && !addTitleProperty(tools.get(name)));
      return message ? { message } : undefined;
    });
  };
}
