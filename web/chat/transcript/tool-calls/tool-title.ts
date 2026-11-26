import { safeText } from "../../../workbench/payloads/safe-text.js";
import { TOOL_TITLES } from "./tool-call-constants.ts";
export function toolTitle(toolName: string): string {
  return TOOL_TITLES[toolName] || safeText(toolName) || "工具";
}
