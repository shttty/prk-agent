import type { CapabilityCatalog } from "../../../config/capabilities/capability-types.ts";
import { gatewaySkills } from "../resources/skills/list-gateway-skills.ts";
import { actualCapabilityEntries } from "./collect-entries.ts";
import { projectCatalog } from "./format-catalog.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function actualCapabilityCatalog(ctx: RuntimeContext): CapabilityCatalog { return projectCatalog(ctx, actualCapabilityEntries(ctx, gatewaySkills(ctx))); }
