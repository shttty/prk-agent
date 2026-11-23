import type { ResourceLoader, Skill } from "@earendil-works/pi-coding-agent";
import type { CapabilityEntry, CapabilitySwitches } from "../../config/capabilities/capability-types.ts";

export type Origin = Pick<CapabilityEntry, "group" | "groupLabel" | "source" | "instance" | "location">;
export interface SkillDirectory { path: string; machine: string; home?: boolean; local?: boolean }
export type CatalogCapabilityEntry = Omit<CapabilityEntry, "enabled" | "configured" | "defaultEnabled" | "overridden" | "groupEnabled">;

export interface CapabilityProjectionContext {
  entries: CatalogCapabilityEntry[];
  defaults: { capabilities: CapabilitySwitches; localTools: boolean };
  overrides: CapabilitySwitches;
  localOverride: boolean | undefined;
  local: boolean;
  skillDirectories: readonly SkillDirectory[];
}

export interface SkillLoaderContext {
  loader: ResourceLoader;
  skills: () => Skill[];
  enabled: (skill: Skill) => boolean;
}
