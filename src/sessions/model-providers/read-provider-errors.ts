import type { LoadExtensionsResult } from "@earendil-works/pi-coding-agent";
import type { ProviderPolicyError } from "./provider-types.ts";

export function readProviderErrors(errors: LoadExtensionsResult["errors"], shared: readonly ProviderPolicyError[] = []): ProviderPolicyError[] {
  const policyErrors = errors.filter((error): error is ProviderPolicyError => error.code === "PROVIDER_POLICY"
    && typeof error.providerId === "string" && (error.operation === "register" || error.operation === "unregister"));
  return [...new Map([...policyErrors, ...shared].map((error) => [`${error.path}\0${error.providerId}\0${error.operation}\0${error.error}`, error])).values()];
}
