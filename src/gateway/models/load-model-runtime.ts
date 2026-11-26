import type { HostContext } from "../host/host-state.ts";
import type { SessionRuntimeDependencies } from "../../sessions/runtime/runtime-types.ts";
import { createAgentSessionFromServices, createAgentSessionRuntime, createAgentSessionServices, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createProviderBootstrap } from "./create-provider-bootstrap.ts";
import { readProviderProxies } from "./provider-proxy/read-provider-proxies.ts";
import { routeProviderProxies } from "./provider-proxy/route-provider-proxies.ts";
import { createSessionSettings } from "../../sessions/session-settings/create-settings.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function sharedModelRuntime(ctx: HostContext): Promise<SessionRuntimeDependencies["modelRuntime"]> {
  return ctx.models.modelRuntime ??= (async () => {
    const injected = ctx.host.dependencies.runtimeDependencies;
    if (injected) {
      ctx.models.modelProviders = injected.modelProviders;
      return ctx.models.resolvedModelRuntime = injected.modelRuntime;
    }
    const { home: cwd, agentDir } = ctx.host.paths;
    let document;
    try { document = JSON.parse(readFileSync(join(agentDir, "models.json"), "utf8")); }
    catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error; }
    routeProviderProxies(readProviderProxies(document));
    const bootstrap = createProviderBootstrap(Object.keys(document?.providers ?? {}));
    ctx.models.modelProviders = bootstrap.modelProviders;
    const runtime = await createAgentSessionRuntime(async ({ sessionManager }) => {
      const services = await createAgentSessionServices({
        cwd, agentDir,
        settingsManager: createSessionSettings(cwd, agentDir, { deny: { packages: [], tools: [] } }, SettingsManager.create(cwd, agentDir, { projectTrusted: false })),
        resourceLoaderOptions: {
          providerOnly: true,
          providerPolicy: bootstrap.providerPolicy,
          noContextFiles: true,
          noSkills: ctx.host.options.noSkills ?? ctx.host.config.session.bootstrapNoSkills,
          additionalExtensionPaths: ctx.host.options.extensionPaths === undefined ? undefined : [...ctx.host.options.extensionPaths],
        },
      });
      bootstrap.finish();
      const result = await createAgentSessionFromServices({ services, sessionManager, noTools: "all" });
      return { ...result, services, diagnostics: services.diagnostics };
    }, { cwd, agentDir, sessionManager: SessionManager.inMemory(cwd) });
    ctx.models.providerRuntime = runtime;
    ctx.models.providerDiagnostics = [
      ...runtime.services.resourceLoader.getExtensions().errors.map((error) => `${error.path}: ${error.error}`),
      ...runtime.diagnostics.map((diagnostic) => diagnostic.message),
    ];
    for (const error of runtime.services.resourceLoader.getExtensions().errors) if (error.code !== "PROVIDER_POLICY") console.error(`[providers] ${error.path}: ${error.error}`);
    if (runtime.diagnostics.some((diagnostic) => diagnostic.type === "error")) console.error("[providers] SDK services rejected a provider or model registration (details withheld).");
    for (const [providerId, owner] of bootstrap.modelProviders.owners) console.info(`[providers] ${providerId}: ${owner.source} (${owner.extensionPath})`);
    runtime.session.extensionRunner.onError((error) => {
      if (error.event !== "provider_policy") console.error(`[providers] ${error.extensionPath} (${error.event}): ${error.error}`);
    });
    // Session construction binds SDK provider actions; no session_start, prompt, kernel, or JSONL is needed.
    return ctx.models.resolvedModelRuntime = runtime.services.modelRuntime;
  })();
}
