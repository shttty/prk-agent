import { Type } from "typebox";
import type { ModelTerminals } from "../../../workspace/model-terminals/model-terminals-types.ts";
import { defineTool } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { name } from "./terminal-tools-constants.ts";
import { yieldSeconds } from "./terminal-tools-constants.ts";
import { resultSchema } from "./terminal-tools-constants.ts";
import { listResultSchema } from "./terminal-tools-constants.ts";
import { TERMINAL_TOOL_METADATA } from "./terminal-tools-constants.ts";
import type { TerminalToolsContext } from "./terminal-tools-types.ts";
import { sendText } from "./send-text.ts";
import { sendKey } from "./send-key.ts";
import { readOutput } from "./read-output.ts";
import { closeTerminal } from "./close-terminal.ts";
import { configureTerminal } from "./set-terminal.ts";
import { listTerminals } from "./list-terminals.ts";

export function createTerminalTools(terminals: () => ModelTerminals): ToolDefinition[] {
  const ctx: TerminalToolsContext = { terminals };
  return [
    defineTool({
      ...TERMINAL_TOOL_METADATA.terminal_list, label: "Terminal list",
      parameters: Type.Object({}, { additionalProperties: false }),
      outputSchema: listResultSchema,
      execute: listTerminals(ctx),
    }),
    defineTool({
      ...TERMINAL_TOOL_METADATA.terminal_textsend, label: "Terminal textsend",
      parameters: Type.Object({ text: Type.String(), name, yield_s: yieldSeconds, timeout_s: Type.Optional(Type.Number({ exclusiveMinimum: 0 })), restart: Type.Optional(Type.Boolean()), quiet_notify: Type.Optional(Type.Boolean({ description: "Set this terminal's background silence notification switch." })), output_brake: Type.Optional(Type.Boolean({ description: "Set this terminal's output brake switch; false exempts continuously logging processes from automatic Ctrl-C." })) }, { additionalProperties: false }),
      outputSchema: resultSchema,
      execute: sendText(ctx),
    }),
    defineTool({
      ...TERMINAL_TOOL_METADATA.terminal_keysend, label: "Terminal keysend",
      parameters: Type.Object({ keys: Type.String({ minLength: 1 }), name, yield_s: yieldSeconds }, { additionalProperties: false }),
      outputSchema: resultSchema,
      execute: sendKey(ctx),
    }),
    defineTool({
      ...TERMINAL_TOOL_METADATA.terminal_read, label: "Terminal read",
      parameters: Type.Object({ name, raw: Type.Optional(Type.Boolean()), command: Type.Optional(Type.String()), offset: Type.Optional(Type.Integer({ minimum: 0 })), yield_s: yieldSeconds }, { additionalProperties: false }),
      outputSchema: resultSchema,
      execute: readOutput(ctx),
    }),
    defineTool({
      ...TERMINAL_TOOL_METADATA.terminal_set, label: "Terminal set",
      parameters: Type.Object({ name, quiet_notify: Type.Optional(Type.Boolean()), output_brake: Type.Optional(Type.Boolean()) }, { additionalProperties: false }),
      outputSchema: Type.Object({ name: Type.String(), quiet_notify: Type.Boolean(), output_brake: Type.Boolean(), note: Type.Optional(Type.String()) }, { additionalProperties: false }),
      execute: configureTerminal(ctx),
    }),
    defineTool({
      ...TERMINAL_TOOL_METADATA.terminal_close, label: "Terminal close",
      parameters: Type.Object({ name: Type.String({ minLength: 1 }) }, { additionalProperties: false }),
      outputSchema: Type.Object({ name: Type.String(), closed: Type.Literal(true) }, { additionalProperties: false }),
      execute: closeTerminal(ctx),
    }),
  ];
}
