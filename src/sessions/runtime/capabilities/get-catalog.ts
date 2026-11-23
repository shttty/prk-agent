import type { CapabilityCatalog } from "../../../config/capabilities/capability-types.ts";
import { remoteConfiguration } from "../configuration/read-remote-config.ts";
import { scopeContext } from "../configuration/read-scope.ts";
import { actualCapabilityEntries } from "./collect-entries.ts";
import { projectCatalog } from "./format-catalog.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function capabilityCatalog(ctx: RuntimeContext): CapabilityCatalog {
    const currentShared = new Set(ctx.sessionOptions.noSkills ? [] : ctx.dependencies.skillLibrary?.paths(scopeContext(ctx)) ?? []);
    const actual = actualCapabilityEntries(ctx);
    const actualIds = new Set(actual.map((entry) => entry.id));
    return projectCatalog(ctx, [
      ...actual,
      ...(ctx.dependencies.globalCapabilityCatalog?.().entries.filter((entry) => !entry.id.startsWith("kernel:") && (!entry.instance || (entry.instance === ctx.target.id && remoteConfiguration(ctx).packages.some((pkg) => pkg.name === entry.source))) && !actualIds.has(entry.id)) ?? []),
    ].filter((entry) => entry.group !== "group:skills:shared" || currentShared.has(entry.source)));
  }
