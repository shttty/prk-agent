import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { AskEnvironment } from "./ask-types.ts";
import { ASK_TOOL_METADATA } from "./ask-metadata.ts";
import { askSchema } from "./question-schema.ts";
import { execute } from "./execute.ts";
/** Native `ask` for every session in every tool mode: the extension-UI question card returns the user's answers. */
export function createAskTool(env: AskEnvironment): ToolDefinition {
  return defineTool({
    ...ASK_TOOL_METADATA, // the name the code-mode bridge pauses its cell deadline for while this waits
    label: "向用户提问",
    parameters: askSchema,
    // One dialog at a time, as in OMP: two cards for one turn only invite the second being answered first.
    executionMode: "sequential",
    execute: (_id, params, signal) => execute(env, _id, params, signal),
  }) as unknown as ToolDefinition;
}
