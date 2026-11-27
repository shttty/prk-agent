import { object } from "../../gateway/wire/is-record.ts";
import type { DerivationRole } from "./derivation-types.ts";
import { DEFAULT_DERIVATION_ROLES, type DerivationConfig } from "./derivation-types.ts";
import { invalid } from "./reject-invalid-config.ts";
import { parseRole } from "./roles/parse-role.ts";
import { TOOL_MODES, type ToolMode } from "../session/session-options.ts";

export function parseDerivationConfig(document: unknown): DerivationConfig {
  if (document === undefined) document = {};
  if (!object(document)) invalid("root must be an object");
  const derivation = document.derivation === undefined ? {} : document.derivation;
  if (!object(derivation)) invalid("derivation must be an object");
  const allowed: Record<string, true> = {
    defaultToolMode: true, defaultIsolated: true,
    maxDepth: true, defaultInstructions: true, roles: true,
  };
  if (Object.keys(derivation).some((key) => allowed[key] !== true)) {
    invalid("derivation contains an unsupported field");
  }
  if (derivation.defaultToolMode !== undefined && !(TOOL_MODES as readonly unknown[]).includes(derivation.defaultToolMode)) invalid("defaultToolMode must be code or direct");
  if (derivation.defaultIsolated !== undefined && typeof derivation.defaultIsolated !== "boolean") invalid("defaultIsolated must be a boolean");
  if (derivation.maxDepth !== undefined && (!Number.isInteger(derivation.maxDepth) || (derivation.maxDepth as number) < 1 || (derivation.maxDepth as number) > 10)) invalid("maxDepth must be an integer from 1 to 10");
  if (derivation.defaultInstructions !== undefined && typeof derivation.defaultInstructions !== "string") invalid("defaultInstructions must be a string");

  const roles = Object.assign(Object.create(null), DEFAULT_DERIVATION_ROLES) as Record<string, DerivationRole>;
  if (derivation.roles !== undefined) {
    if (!object(derivation.roles)) invalid("roles must be an object");
    for (const [role, value] of Object.entries(derivation.roles)) {
      if (role.trim().length === 0) invalid("role names must not be empty");
      roles[role] = Object.freeze({ ...roles[role], ...parseRole(value, role) });
    }
  }
  for (const [role, { spawns }] of Object.entries(roles)) {
    const unknown = spawns?.find((name) => !Object.hasOwn(roles, name));
    if (unknown !== undefined) invalid(`role ${JSON.stringify(role)} spawns unknown role ${JSON.stringify(unknown)}`);
  }

  return Object.freeze({
    ...(derivation.defaultToolMode === undefined ? {} : { defaultToolMode: derivation.defaultToolMode as ToolMode }),
    ...(derivation.defaultIsolated === undefined ? {} : { defaultIsolated: derivation.defaultIsolated as boolean }),
    ...(derivation.maxDepth === undefined ? {} : { maxDepth: derivation.maxDepth as number }),
    ...(derivation.defaultInstructions === undefined ? {} : { defaultInstructions: derivation.defaultInstructions as string }),
    roles: Object.freeze(roles),
  });
}
