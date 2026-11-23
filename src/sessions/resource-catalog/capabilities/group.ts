import { homedir } from "node:os";
import { resolve } from "node:path";
import type { CapabilityCatalog } from "../../../config/capabilities/capability-types.ts";
import type { CapabilityProjectionContext } from "../catalog-types.ts";
import { skillDirectoryGroup } from "../origins/identify-skill-directory-group.ts";
import { value } from "./value.ts";
import { defaultValue } from "./default-value.ts";
import { overridden } from "./overridden.ts";

export const group = (ctx: CapabilityProjectionContext, id: string, name: string, kind: "tool" | "skill"): CapabilityCatalog["groups"][number] => {
  const directory = ctx.skillDirectories.find((directory) => skillDirectoryGroup(directory) === id);
  const dynamic = /^group:skills:dir:([^:]+):(\/.*)$/u.exec(id);
  return {
    id, name, kind, enabled: value(ctx, id),
    defaultEnabled: defaultValue(ctx, id), overridden: overridden(ctx, id), available: true,
    ...(() => {
      const origin = ctx.entries.find((entry) => entry.group === id);
      return origin?.instance ? { instance: origin.instance, location: origin.location } : {};
    })(),
    ...(directory ? { path: directory.path, machine: directory.machine }
      : id === "group:skills:global" ? { path: resolve(homedir(), ".agents/skills"), machine: "gateway" }
        : dynamic ? { path: dynamic[2]!, machine: dynamic[1]! } : {}),
  };
};
