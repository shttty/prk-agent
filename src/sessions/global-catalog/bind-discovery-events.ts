import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { EXTENSION_HANDLER_ABORT_MESSAGE } from "../extension-invocation/invocation-constants.ts";
import type { CatalogContext } from "./catalog-types.ts";
import { notify } from "./notify.ts";
import { readProviderErrors } from "../model-providers/read-provider-errors.ts";
import { extensionStartupSource } from "./extension-startup-source.ts";
import { recordPluginError } from "./record-plugin-error.ts";

export function bindDiscoveryEvents(ctx: CatalogContext, session: AgentSession) {
  return session.bindExtensions({
    mode: "print",
    uiContext: {
      ...session.extensionRunner.getUIContext(),
      notify(message, type) { notify(ctx, message, type); },
    },
    onError(error) {
      if (error.event === "provider_policy") {
        ctx.providerErrors = readProviderErrors(session.resourceLoader.getExtensions().errors, ctx.input.modelProviders?.errors);
        return;
      }
      // Expected owner cancellation is still a Pi handler error, not a failed metadata discovery.
      if (ctx.closing && error.event === "session_shutdown" && error.error === EXTENSION_HANDLER_ABORT_MESSAGE) return;
      const extension = session.resourceLoader.getExtensions().extensions.find(({ path }) => path === error.extensionPath);
      recordPluginError(ctx, extensionStartupSource(extension?.sourceInfo), `${error.event}: ${error.error}`, error.extensionPath);
    },
  });
}
