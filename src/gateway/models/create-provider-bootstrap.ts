import type { ProviderOwner, ProviderPolicy, ProviderPolicyError } from "../../sessions/model-providers/provider-types.ts";

export function createProviderBootstrap(manualProviderIds: Iterable<string>) {
  const manual = new Set(manualProviderIds);
  const owners = new Map<string, ProviderOwner>();
  const errors: ProviderPolicyError[] = [];
  let loading = true;
  const providerPolicy: ProviderPolicy = (request) => {
    const { providerId, operation, source, extensionPath } = request;
    const owner = owners.get(providerId);
    let error;
    if (manual.has(providerId)) error = `PRK models.json owns provider ${JSON.stringify(providerId)}; plugin registration and removal are not allowed.`;
    else if (owner?.source === source) return true;
    else if (!owner && loading && operation === "unregister") return false;
    else if (!owner && loading && operation === "register") {
      owners.set(providerId, { source, extensionPath });
      return true;
    } else error = owner
      ? `PRK provider ${JSON.stringify(providerId)} is owned by ${owner.source}; the first loaded package wins.`
      : `PRK provider ${JSON.stringify(providerId)} was not registered during Gateway bootstrap; background registration may only update owned IDs.`;
    errors.push({ code: "PROVIDER_POLICY", providerId, operation, path: extensionPath, source, error });
    console.error(`[providers] ${extensionPath}: ${operation}: ${error}`);
    return error;
  };
  return { modelProviders: { owners, errors }, providerPolicy, finish() { loading = false; } };
}
