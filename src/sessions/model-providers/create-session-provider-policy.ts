import type { ModelProviderOwnership, ProviderPolicy } from "./provider-types.ts";

/** Sessions and discovery may use shared models, but never change their providers. */
export function createSessionProviderPolicy(ownership?: ModelProviderOwnership): ProviderPolicy {
  return ({ providerId, operation, extensionPath }) => {
    if (ownership?.owners.has(providerId)) {
      console.debug(`[providers] ${extensionPath}: ${operation} ${providerId} ignored; provided by Gateway.`);
      return false;
    }
    const error = `PRK provider ${JSON.stringify(providerId)} has no Gateway plugin owner; register it during Gateway bootstrap or configure it in models.json.`;
    console.error(`[providers] ${extensionPath}: ${operation}: ${error}`);
    return error;
  };
}
