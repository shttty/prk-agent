import { createAgentSession, createAgentSessionRuntime, createAgentSessionServices, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createSessionSettings } from "../session-settings/create-settings.ts";
import { HOSTED_THEME_PATHS } from "../session-settings/theme-paths.ts";
import { prepareRemoteExtensions } from "../../remote-extensions/session-load/prepare.ts";
import type { CatalogContext } from "./catalog-types.ts";
import { extensionsOverride } from "./extensions-override.ts";
import { skillsOverride } from "./skills-override.ts";
import { projectTrusted } from "./project-trusted.ts";
import { assembleCatalogPlugins } from "./assemble-catalog-plugins.ts";
import { createSessionProviderPolicy } from "../model-providers/create-session-provider-policy.ts";
import { readProviderErrors } from "../model-providers/read-provider-errors.ts";
import { recordLoadErrors } from "./record-load-errors.ts";
import { disabledBuiltins } from "../session-settings/disabled-builtins.ts";

export function createDiscoveryRuntime(ctx: CatalogContext) {
  const input = ctx.input;
  return createAgentSessionRuntime(async ({ cwd, agentDir, sessionManager, sessionStartEvent }) => {
    const settingsManager = createSessionSettings(cwd, agentDir, input.config.extensions, SettingsManager.create(cwd, agentDir, { projectTrusted: false }), ctx.pluginFailures);
    if (input.remoteExtensions) ctx.remoteLoad = await prepareRemoteExtensions({ ...input.remoteExtensions,
      providerOwnerIds: [...(input.modelProviders?.owners.keys() ?? [])], projectTrusted: () => projectTrusted(settingsManager) });
    const services = await createAgentSessionServices({
      cwd, agentDir, modelRuntime: input.modelRuntime,
      settingsManager,
      resourceLoaderOptions: {
        providerPolicy: createSessionProviderPolicy(input.modelProviders),
        extensionsOverride: (base) => extensionsOverride(ctx, base),
        noExtensions: false,
        noSkills: false,
        noPromptTemplates: input.config.session.noPromptTemplates,
        noThemes: input.config.session.noThemes,
        noContextFiles: true,
        additionalThemePaths: HOSTED_THEME_PATHS,
        disabledBuiltinExtensions: disabledBuiltins(ctx.pluginFailures),
        additionalExtensionPaths: [...(input.extensionPaths ?? []).filter((path) => !ctx.pluginFailures.has(path)), ...(ctx.remoteLoad?.paths ?? [])],
        skillsOverride: (base) => skillsOverride(base, cwd, agentDir),
        extensionFactories: [...(ctx.remoteLoad?.factories ?? []), ...assembleCatalogPlugins(ctx, sessionManager)],
      },
    });
    const extensions = services.resourceLoader.getExtensions();
    const sources = new Map(extensions.extensions.flatMap((extension): Array<[string, string]> => [[extension.path, extension.sourceInfo.source], [extension.resolvedPath, extension.sourceInfo.source]]));
    ctx.providerErrors = readProviderErrors(extensions.errors, input.modelProviders?.errors).map((error) => ({ ...error, source: error.source ?? sources.get(error.path) }));
    const failures = extensions.errors.filter((error) => error.code !== "PROVIDER_POLICY");
    const extensionErrors = ctx.remoteLoad?.inspect(extensions.extensions, failures) ?? failures;
    // SDK 1.5.2 services diagnostics here come from provider/model registration, and can contain credentials.
    if (services.diagnostics.some((item) => item.type === "error")) {
      ctx.failures.push("SDK services rejected a provider or model registration (details withheld).");
    }
    await recordLoadErrors(ctx, settingsManager, extensionErrors);
    const result = await createAgentSession({
      cwd, agentDir, modelRuntime: services.modelRuntime, settingsManager: services.settingsManager,
      resourceLoader: services.resourceLoader, sessionManager, sessionStartEvent,
      ...(input.model === undefined ? {} : { model: input.model }),
      tools: ["*"], excludeTools: [], customTools: ctx.nativeTools,
    });
    return { ...result, services, diagnostics: services.diagnostics };
  }, { cwd: input.cwd, agentDir: input.agentDir, sessionManager: SessionManager.inMemory(input.cwd) }).catch(async (error) => {
    ctx.extensionHandlers.close();
    await ctx.remoteLoad?.close();
    throw error;
  });
}
