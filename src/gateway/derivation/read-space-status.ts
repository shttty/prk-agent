import type { JsonValue } from "@earendil-works/pi-ai";
import type { HostContext } from "../host/host-state.ts";
import { sanitizeTargets } from "../instances/format-public-instances.ts";
import { DEFAULT_DERIVATION_ROLE } from "../../config/derivation/derivation-types.ts";
import { sessionRoleMarkers } from "./session-role-markers.ts";

export async function readSpaceStatus(ctx: HostContext, target?: string): Promise<JsonValue> {
  const catalog = await ctx.methods.modelCatalog();
  const { derivation, defaults } = ctx.methods.derivationGet();
  return {
    targets: sanitizeTargets(ctx.instances.targets),
    sessions: ctx.methods.managed().map((session) => ({
      ...session, ...sessionRoleMarkers(ctx.methods.sessionRoles(session.sessionId)),
    })),
    ...catalog,
    roles: Object.entries(derivation.roles ?? {}).map(([name, role]) => ({
      name, ...(role.model === undefined ? {} : { model: role.model }),
      ...(role.thinkingLevel === undefined ? {} : { thinkingLevel: role.thinkingLevel }),
      ...(role.description === undefined ? {} : { description: role.description }),
      ...(role.toolMode === undefined ? {} : { toolMode: role.toolMode }),
      ...(role.isolated === undefined ? {} : { isolated: role.isolated }),
    })),
    derivationDefaults: {
      toolMode: derivation.defaultToolMode ?? defaults.defaultToolMode,
      isolated: derivation.defaultIsolated ?? defaults.defaultIsolated,
      maxDepth: derivation.maxDepth ?? defaults.maxDepth,
    },
    inheritance: `Model/thinking per field: explicit spawn value > selected configured role > creator current value. Tool mode: role > derivation default > host session default; it is not a spawn parameter. Isolation: explicit spawn value > role > derivation default > false. Child depth must not exceed maxDepth; top level is depth 0. Instructions: explicit role string (including empty) > derivation default > built-in default. Role capabilities seed the child's session overrides. Omit role to use ${DEFAULT_DERIVATION_ROLE}. Valid thinking levels belong to the selected model; unsupported inherited values fail, never coerce. Target defaults to the creator's target; explicit target wins. Python is selected only by the configured instance.`,
    ...(target === undefined ? {} : { target }),
  } as unknown as JsonValue;
}
