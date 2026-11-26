import type { ApiFailure } from "../../shell/page/page-types.ts";

export type PluginLocation = "gateway" | "host";

/** A provider ownership diagnostic from the plugin config (`ProviderPolicyError`). */
export type ProviderError = { code: string; providerId: string; operation: string; path?: string; source?: string; error: string };

/** One installed Pi package as `/plugins` lists it. */
export type PluginPackage = {
  source: string; name: string; version?: string; sourceKind: "local" | "npm" | "git"; sourceDisplay: string; location: PluginLocation; enabled: boolean;
  commands: { name: string; description?: string }[]; providerIds: string[]; providerErrors: ProviderError[]; warnings?: string[];
  error?: string; errorCode?: string; errorDetails?: ApiFailure["details"] & { providerErrors?: ProviderError[]; member?: string };
};

export type PluginList = { packages: PluginPackage[]; restartRequired?: boolean };

/** A rejected plugin request: `source` is the package it concerned (null: the install form). */
export type PluginRejection = { source: string | null; message: string; code?: string; details?: ApiFailure["details"] & { providerErrors?: ProviderError[]; member?: string } };

/** The part of the capability catalog the plugin page reads. */
export type PluginCatalog = { groups: { id: string; kind: string }[]; entries: { kind: string; group: string }[] };

export type PluginTools = { groupId: string | undefined; count: number };
