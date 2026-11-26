import type { Api, Model, SimpleStreamOptions, StreamOptions } from "@earendil-works/pi-ai";
import { getApiProvider, registerApiProvider } from "@earendil-works/pi-ai/compat";
import { Agent, ProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";
import type { ProviderProxies, ProviderProxy } from "./read-provider-proxies.ts";

const SOURCE_ID = "prk-provider-proxy";

/**
 * Replaces the pi-ai API registry entries used by proxied providers with wrappers that inject
 * `options.fetch` for those providers' models and pass every other model through unchanged.
 */
export function routeProviderProxies({ providers, apis }: ProviderProxies): void {
  if (providers.size === 0) return;
  const fetches = new Map<string, typeof globalThis.fetch>();
  for (const [providerId, proxy] of providers) {
    fetches.set(providerId, dispatcherFetch(proxy === "direct" ? new Agent() : new ProxyAgent(proxy.href)));
    console.info(`[provider-proxy] ${providerId}: ${describe(proxy)}`);
  }
  const route = <T extends StreamOptions>(model: Model<Api>, options: T | undefined): T | undefined => {
    const fetch = fetches.get(model.provider);
    return fetch ? { ...options, fetch } as T : options;
  };
  for (const api of apis) {
    // compat registers every built-in API at import, and the reader only admits built-in APIs.
    const inner = getApiProvider(api)!;
    registerApiProvider({
      api,
      stream: (model, context, options) => inner.stream(model, context, route(model, options)),
      streamSimple: (model, context, options?: SimpleStreamOptions) => inner.streamSimple(model, context, route(model, options)),
    }, SOURCE_ID);
  }
}

// npm undici's fetch, not globalThis.fetch: Node's built-in fetch does not accept npm undici dispatchers.
function dispatcherFetch(dispatcher: Dispatcher): typeof globalThis.fetch {
  const fetch = (input: Parameters<typeof undiciFetch>[0], init?: Parameters<typeof undiciFetch>[1]) => undiciFetch(input, { ...init, dispatcher });
  return fetch as unknown as typeof globalThis.fetch;
}

function describe(proxy: ProviderProxy): string {
  if (proxy === "direct") return "direct";
  return `${proxy.protocol}//${proxy.hostname}:${proxy.port || (proxy.protocol === "https:" ? "443" : "80")}`;
}
