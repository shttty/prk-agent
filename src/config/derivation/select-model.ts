import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { DerivationConfig } from "./derivation-types.ts";
import type { DerivationModelRequest } from "./derivation-types.ts";
import type { ParentModel } from "./derivation-types.ts";
import type { DerivationModelSelection } from "./derivation-types.ts";
import { resolveModel } from "./models/resolve-model.ts";
import { DEFAULT_DERIVED_INSTRUCTIONS, DEFAULT_DERIVATION_ROLE, DEFAULT_DERIVATION_ROLES } from "./derivation-types.ts";

export function selectDerivationModel(
  config: DerivationConfig,
  request: DerivationModelRequest,
  parent: ParentModel,
  modelRuntime: ModelRuntime,
): DerivationModelSelection {
  if (request.lifecycle !== "temporary" && request.lifecycle !== "persistent" && request.lifecycle !== "user") {
    throw new Error(`Invalid derivation lifecycle ${JSON.stringify(request.lifecycle)}.`);
  }
  if (request.role !== undefined && (typeof request.role !== "string" || request.role.length === 0)) {
    throw new Error("Derivation role must be a non-empty string.");
  }

  const roleName = request.role ?? DEFAULT_DERIVATION_ROLE;
  const roles = config.roles ?? DEFAULT_DERIVATION_ROLES;
  const role = Object.hasOwn(roles, roleName) ? roles[roleName]
    : Object.hasOwn(DEFAULT_DERIVATION_ROLES, roleName) ? DEFAULT_DERIVATION_ROLES[roleName] : undefined;
  if (!role) throw new Error(`Unknown derivation role ${JSON.stringify(roleName)}.`);

  const modelSpec = request.model ?? role.model;
  const model = modelSpec === undefined ? parent.model : resolveModel(modelSpec, modelRuntime);
  const thinkingLevel = request.thinkingLevel ?? role.thinkingLevel ?? parent.thinkingLevel;
  const supported = getSupportedThinkingLevels(model) as readonly ModelThinkingLevel[];
  if (!supported.includes(thinkingLevel as ModelThinkingLevel)) {
    throw new Error(`Thinking level ${JSON.stringify(thinkingLevel)} is unavailable for ${model.provider}/${model.id}; available levels: ${supported.join(", ")}.`);
  }

  return {
    model,
    thinkingLevel,
    instructions: role.instructions !== undefined ? role.instructions : (config.defaultInstructions ?? DEFAULT_DERIVED_INSTRUCTIONS),
  };
}
