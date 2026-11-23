import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { ModelTerminals } from "../../workspace/model-terminals/model-terminals-types.ts";
import type { TerminalEventBinding } from "../../workspace/terminal-notifications/notification-types.ts";
import { bindTerminalEvents } from "../../workspace/terminal-notifications/bind-events.ts";
import { createTerminalTools } from "./tools/create-tools.ts";

export function assembleTerminalsPlugin(terminals: ModelTerminals | (() => ModelTerminals) | undefined, runtime?: {
  currentBinding(): TerminalEventBinding | undefined;
  setBinding(binding: TerminalEventBinding | undefined): void;
}): ExtensionFactory {
  return (pi) => {
    if (terminals) for (const tool of createTerminalTools(typeof terminals === "function" ? terminals : () => terminals)) pi.registerTool(tool);
    if (runtime) {
      runtime.currentBinding()?.dispose();
      if (terminals && typeof terminals !== "function") runtime.setBinding(bindTerminalEvents(pi, terminals));
      pi.on("session_shutdown", () => {
        runtime.currentBinding()?.dispose();
        runtime.setBinding(undefined);
      });
    }
  };
}
