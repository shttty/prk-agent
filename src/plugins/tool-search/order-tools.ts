import type { ToolInfo } from "@earendil-works/pi-coding-agent";
import { SESSIONS_PLUGIN_PATH } from "../sessions/plugin-identity.ts";
import { ASK_PLUGIN_PATH } from "../ask/plugin-identity.ts";
import { SKILL_TOOLS_PLUGIN_PATH } from "../skill-tools/plugin-identity.ts";
import { MEMORY_PLUGIN_PATH } from "../memory/plugin-identity.ts";
import { PLUGIN_CONFIG_PLUGIN_PATH } from "../plugin-config/plugin-identity.ts";
import { TERMINALS_PLUGIN_PATH } from "../terminals/plugin-identity.ts";
import { KERNEL_PLUGIN_PATH } from "../kernel/plugin-identity.ts";
import { TOOL_SEARCH_PLUGIN_PATH } from "./plugin-identity.ts";

const TOOL_BLOCKS: Record<string, number> = {
  [KERNEL_PLUGIN_PATH]: 1, [TOOL_SEARCH_PLUGIN_PATH]: 2,
  [SESSIONS_PLUGIN_PATH]: 3, [ASK_PLUGIN_PATH]: 3, [SKILL_TOOLS_PLUGIN_PATH]: 3,
  [MEMORY_PLUGIN_PATH]: 3, [PLUGIN_CONFIG_PLUGIN_PATH]: 3, [TERMINALS_PLUGIN_PATH]: 3,
};

/** Preserve external/library → kernel → discovery → business order in both request projections. */
export function orderTools<T extends Pick<ToolInfo, "name" | "sourceInfo">>(tools: T[]): T[] {
  const blocks: T[][] = [[], [], [], []];
  for (const tool of tools) blocks[TOOL_BLOCKS[tool.sourceInfo.path] ?? 0]!.push(tool);
  const ordered = blocks[0]!;
  ordered.push(...blocks[1]!, ...blocks[2]!, ...blocks[3]!);
  return ordered;
}
