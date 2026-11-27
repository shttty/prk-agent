import { DEFAULT_DERIVATION_ROLE } from "../../../config/derivation/derivation-types.ts";
import type { SpawnableRole } from "../session-types.ts";

export function renderRoles(roles: readonly SpawnableRole[]): string {
  if (roles.length === 0) return "Your role cannot spawn child sessions; session_spawn will be rejected.";
  const fallback = roles.some(({ name }) => name === DEFAULT_DERIVATION_ROLE) ? `omit role for ${DEFAULT_DERIVATION_ROLE}` : "role is required";
  return [
    "Roles for session_spawn:",
    ...roles.map(({ name, description }) => description ? `${name}: ${description}` : name),
    `Pick the role whose description fits the task; ${fallback}.`,
  ].join("\n");
}
