import { encode } from "../codec/encode.mjs";
import { send } from "../host/connection/send-frame.mjs";

/** Target extensions only acknowledge Gateway ownership; provider implementations stay local. */
export function applyProviderPolicy(ctx, owner, pkg, path, operation, providerId) {
  ctx.assertLive(owner);
  if (owner.providerOwnerIds.has(providerId)) {
    console.debug(`[providers] ${path}: ${operation} ${providerId} ignored; provided by Gateway.`);
    return false;
  }
  const error = `PRK provider ${JSON.stringify(providerId)} has no Gateway plugin owner; register it during Gateway bootstrap or configure it in models.json.`;
  const diagnostic = { code: "PROVIDER_POLICY", providerId, operation, path, error, source: pkg.name };
  (pkg.providerErrors ??= []).push(diagnostic);
  console.error(`[providers] ${path}: ${operation}: ${error}`);
  if (owner.phase === "active") {
    send(ctx, { kind: "provider_policy", id: `host:${++ctx.sequence}`, payload: encode({ name: pkg.name, diagnostic }) });
  }
  return false;
}
