import type { Api } from "@earendil-works/pi-ai";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";

/** A proxy URL, or `direct` for `proxy: false`, which also bypasses NODE_USE_ENV_PROXY. */
export type ProviderProxy = URL | "direct";

export interface ProviderProxies {
  readonly providers: ReadonlyMap<string, ProviderProxy>;
  /** APIs used by proxied providers' models; only these registry entries are wrapped. */
  readonly apis: ReadonlySet<Api>;
}

interface ProviderDocument {
  readonly proxy?: unknown;
  readonly api?: Api;
  readonly oauth?: unknown;
  readonly models?: readonly { readonly api?: Api }[];
}

// pi-ai 1.6.0 APIs that send every request through StreamOptions.fetch. Bedrock uses the AWS SDK
// handler, Codex defaults to WebSocket and Vertex ADC fetches tokens itself, so a proxy would be ignored.
const FETCH_APIS: ReadonlySet<string> = new Set([
  "anthropic-messages", "openai-completions", "openai-responses", "azure-openai-responses",
  "google-generative-ai", "mistral-conversations", "pi-messages",
]);

export function readProviderProxies(document: { readonly providers?: Readonly<Record<string, ProviderDocument>> } | undefined): ProviderProxies {
  const providers = new Map<string, ProviderProxy>();
  const apis = new Set<Api>();
  const builtin = new Set(builtinProviders().map((provider) => provider.id));
  for (const [providerId, config] of Object.entries(document?.providers ?? {})) {
    if (config.proxy === undefined) continue;
    providers.set(providerId, parseProxy(providerId, config.proxy));
    // Pi streams models of built-in (and radius) providers with its own implementation, bypassing the API registry.
    if (builtin.has(providerId) || config.oauth === "radius") {
      throw new Error(`models.json provider ${JSON.stringify(providerId)}: proxy is not supported on a Pi built-in provider ID; rename the provider.`);
    }
    for (const api of [config.api, ...(config.models ?? []).map((model) => model.api)]) {
      if (api === undefined) continue;
      if (!FETCH_APIS.has(api)) throw new Error(`models.json provider ${JSON.stringify(providerId)}: proxy is not supported for api ${JSON.stringify(api)}.`);
      apis.add(api);
    }
  }
  return { providers, apis };
}

function parseProxy(providerId: string, value: unknown): ProviderProxy {
  if (value === false) return "direct";
  const url = typeof value === "string" && URL.canParse(value) ? new URL(value) : undefined;
  if (url?.protocol === "http:" || url?.protocol === "https:") return url;
  // The value is not echoed: it may carry proxy credentials.
  throw new Error(`models.json provider ${JSON.stringify(providerId)}: proxy must be an http:// or https:// URL, or false.`);
}
