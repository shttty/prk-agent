import type { PackageSource } from "@earendil-works/pi-coding-agent";
import type { ProviderPolicyError } from "../../sessions/model-providers/provider-types.ts";

export type PluginLocation = "host" | "gateway";
export type PluginPackage = Exclude<PackageSource, string> & { enabled: boolean; location: PluginLocation };
interface ResolvedPluginPackage extends PluginPackage {
  name: string;
  version?: string;
  sourceKind: "local" | "npm" | "git";
  sourceDisplay: string;
  installedPath?: string;
}
export interface PluginView extends ResolvedPluginPackage {
  commands: Array<{ name: string; description?: string }>;
  providerIds: string[];
  providerErrors: ProviderPolicyError[];
  warnings: string[];
  error?: string;
  errorCode?: string;
  errorDetails?: Record<string, unknown>;
}
export interface PluginList { packages: PluginView[]; restartRequired: boolean }
export interface PluginInstall { source: string; location?: PluginLocation }
export interface PluginChange { source: string; enabled?: boolean; location?: PluginLocation }
export interface PluginUninstall { source: string; confirm: true }
export interface HostPluginPackage extends ResolvedPluginPackage { agentDir: string; error?: string }
