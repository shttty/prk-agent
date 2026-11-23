import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { RemoteExtensionOptions } from "./generation-types.ts";
import { assembleGeneration } from "./assemble-generation.ts";
import { registerNativeTools } from "./callbacks/register-native-tools.ts";

/** Pass to DefaultResourceLoader.extensionFactories. Only target plugins require eager loading. */
export function createRemoteExtensionFactory(options: RemoteExtensionOptions): ExtensionFactory {
  return async (pi) => {
    const host = assembleGeneration(options);
    options.onCreated?.(host);
    if (options.nativeTools && !options.packages.length && !options.projectExtensions?.length) registerNativeTools(host, pi);
    else host.register(pi, await host.start());
  };
}
