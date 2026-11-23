import { safeText } from "../../../workbench/payloads/safe-text.js";
import { TOOL_TITLES } from "./tool-call-constants.js";
export function toolTitle(toolName) {
  return TOOL_TITLES[toolName] || safeText(toolName) || "工具";
}
