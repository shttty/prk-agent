import { object } from "../../../gateway/wire/is-record.ts";
import type { DerivationRole } from "../derivation-types.ts";
import { invalid } from "../reject-invalid-config.ts";
import { parseModel } from "../models/parse-model.ts";
import { parseThinkingLevel } from "../models/parse-thinking-level.ts";
import { TOOL_MODES, type ToolMode } from "../../session/session-options.ts";
import { isCapabilitySwitches } from "../../capabilities/is-capability-switches.ts";
import type { CapabilitySwitches } from "../../capabilities/capability-types.ts";

export function parseRole(value: unknown, role: string): DerivationRole {
  if (!object(value)) invalid(`role ${JSON.stringify(role)} must be an object`);
  const allowed: Record<string, true> = { description: true, model: true, thinkingLevel: true, toolMode: true, isolated: true, instructions: true, capabilities: true };
  if (Object.keys(value).some((key) => allowed[key] !== true)) {
    invalid(`role ${JSON.stringify(role)} contains an unsupported field`);
  }
  const field = `role ${JSON.stringify(role)}`;
  if (value.description !== undefined && typeof value.description !== "string") invalid(`${field} description must be a string`);
  if (value.toolMode !== undefined && !(TOOL_MODES as readonly unknown[]).includes(value.toolMode)) invalid(`${field} toolMode must be code or direct`);
  if (value.isolated !== undefined && typeof value.isolated !== "boolean") invalid(`${field} isolated must be a boolean`);
  if (value.instructions !== undefined && typeof value.instructions !== "string") invalid(`${field} instructions must be a string`);
  if (value.capabilities !== undefined && !isCapabilitySwitches(value.capabilities)) invalid(`${field} capabilities must map capability IDs to booleans; local tools use session.localTools`);
  return {
    ...(value.description === undefined ? {} : { description: value.description as string }),
    ...(value.model === undefined ? {} : { model: parseModel(value.model, `role ${JSON.stringify(role)} model`) }),
    ...(value.thinkingLevel === undefined ? {} : { thinkingLevel: parseThinkingLevel(value.thinkingLevel, `role ${JSON.stringify(role)} thinkingLevel`) }),
    ...(value.toolMode === undefined ? {} : { toolMode: value.toolMode as ToolMode }),
    ...(value.isolated === undefined ? {} : { isolated: value.isolated as boolean }),
    ...(value.instructions === undefined ? {} : { instructions: value.instructions as string }),
    ...(value.capabilities === undefined ? {} : { capabilities: { ...value.capabilities as CapabilitySwitches } }),
  };
}
