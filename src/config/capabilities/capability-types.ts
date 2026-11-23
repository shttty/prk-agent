import type { ToolExposure } from "@earendil-works/pi-coding-agent";
import type { TerminalOptions } from "../terminal/terminal-options.ts";
import type { ProviderPolicyError } from "../../sessions/model-providers/provider-types.ts";
export type CapabilitySwitches = Record<string, boolean>;
export type CapabilityChanges = Record<string, boolean | null>;

export interface CapabilityChange {
  id: string;
  enabled: boolean | null;
}

export interface ToolLazy {
  id: string;
  enabled: boolean;
  defaultEnabled: boolean;
  overridden: boolean;
  available: boolean;
}

export interface CapabilityEntry {
  id: string;
  kind: "tool" | "skill";
  name: string;
  description: string;
  group: string;
  groupLabel: string;
  source: string;
  instance?: string;
  location?: "local" | "target";
  enabled: boolean;
  exposure?: ToolExposure;
  lazy?: ToolLazy;
  loaded?: boolean;
  configured: boolean;
  defaultEnabled: boolean;
  overridden: boolean;
  groupEnabled: boolean;
  locked?: boolean;
  available?: boolean;
  library?: unknown;
  shadowedBy?: string;
  module?: string;
  error?: string;
  overridesBuiltin?: boolean;
  dependencies?: unknown;
  moduleOnly?: boolean;
  pending?: boolean;
}

export interface CapabilityCatalog {
  entries: CapabilityEntry[];
  providerErrors?: ProviderPolicyError[];
  groups: Array<{
    id: string;
    name: string;
    kind: "tool" | "skill";
    enabled: boolean;
    defaultEnabled: boolean;
    overridden: boolean;
    available?: boolean;
    lazy?: ToolLazy;
    path?: string;
    machine?: string;
    instance?: string;
    location?: "local" | "target";
  }>;
  localTools: boolean;
  requiresReload: boolean;
}

export interface CapabilityDefaults {
  capabilities: CapabilitySwitches;
  localTools: boolean;
}

export interface CapabilitySettings {
  catalog: CapabilityCatalog;
  defaults: CapabilityDefaults;
  terminal: TerminalOptions;
  instanceError?: string;
}

export type CapabilitySettingsChange =
  | { changes: CapabilityChange[] }
  | { instance: string; changes: CapabilityChange[] }
  | { terminal: Partial<TerminalOptions> };
