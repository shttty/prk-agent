import type { CreateAgentSessionServicesOptions } from "@earendil-works/pi-coding-agent";

export type ProviderPolicy = NonNullable<NonNullable<CreateAgentSessionServicesOptions["resourceLoaderOptions"]>["providerPolicy"]>;
export type ProviderRequest = Parameters<ProviderPolicy>[0];

export interface ProviderOwner {
  readonly source: string;
  readonly extensionPath: string;
}

export interface ProviderPolicyError {
  readonly code: "PROVIDER_POLICY";
  readonly providerId: string;
  readonly operation: "register" | "unregister";
  readonly path: string;
  readonly error: string;
  readonly source?: string;
}

/** Gateway bootstrap owns this metadata; sessions only acknowledge its provider IDs. */
export interface ModelProviderOwnership {
  readonly owners: ReadonlyMap<string, ProviderOwner>;
  readonly errors: readonly ProviderPolicyError[];
}
