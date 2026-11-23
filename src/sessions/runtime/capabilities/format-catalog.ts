import type { CapabilityCatalog } from "../../../config/capabilities/capability-types.ts";
import { LOCAL_TOOLS_GROUP } from "../../resource-catalog/catalog-constants.ts";
import { projectCapabilities } from "../../resource-catalog/format-capabilities.ts";
import { remoteExtensionFingerprint } from "../../../remote-extensions/packages/fingerprint-packages.ts";
import { defaults } from "../configuration/read-defaults.ts";
import { localEnabled } from "../configuration/read-native-tools.ts";
import { remoteConfiguration } from "../configuration/read-remote-config.ts";
import { scopeContext } from "../configuration/read-scope.ts";
import { targetDirectories } from "../resources/list-target-directories.ts";
import { allSkills } from "../resources/skills/list-skills.ts";
import { registrationFileVersions } from "../resources/registration/read-file-versions.ts";
import { fileVersionsChanged } from "../resources/registration/have-file-versions-changed.ts";
import type { CapabilityMetadata } from "../runtime-types.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { lazyLayers } from "./read-lazy-layers.ts";
import { capabilityEnabled } from "./is-capability-enabled.ts";
import { readProviderErrors } from "../../model-providers/read-provider-errors.ts";

export function projectCatalog(ctx: RuntimeContext, entries: CapabilityMetadata[]): CapabilityCatalog {
    const catalog = projectCapabilities(entries.map((entry) => ({ ...entry, ...(entry.group === LOCAL_TOOLS_GROUP ? { ...(!ctx.target.local ? { groupLabel: "原生工具" } : {}), location: "target" as const } : {}), locked: entry.id === "tool:kernel_code" && ctx.toolMode === "code" })), defaults(ctx), ctx.capabilityOverrides, ctx.localOverride, ctx.target.local === true, targetDirectories(ctx), lazyLayers(ctx));
    catalog.providerErrors = readProviderErrors(ctx.unfilteredLoader?.getExtensions().errors ?? [],
      [...(ctx.dependencies.modelProviders?.errors ?? []), ...(ctx.remoteLoad?.providerErrors ?? [])]);
    const registered = new Set(ctx.callbackSession?.getAllTools().map((tool) => tool.name) ?? []);
    const skills = allSkills(ctx);
    const loadedSkills = new Set(skills.map((skill) => `skill:${skill.filePath}`));
    for (const entry of catalog.entries) {
      entry.loaded = entry.kind === "skill" ? loadedSkills.has(entry.id)
        : entry.id.startsWith("kernel:") ? entry.available !== false : registered.has(entry.name);
      if (entry.id.startsWith("kernel:") && entry.module === "files"
        && (localEnabled(ctx) || !capabilityEnabled(ctx, "kernel:module:files"))) entry.enabled = false;
    }
    const currentShared = new Set(ctx.sessionOptions.noSkills ? [] : ctx.dependencies.skillLibrary?.paths(scopeContext(ctx)) ?? []);
    const currentFiles = registrationFileVersions(ctx, skills);
    catalog.requiresReload = catalog.entries.some((entry) => entry.available !== false && !entry.loaded && !(entry.kind === "skill" && ctx.sessionOptions.noSkills))
      || currentShared.size !== ctx.sharedPaths.size || [...currentShared].some((path) => !ctx.sharedPaths.has(path))
      || fileVersionsChanged(ctx.registrationFiles, currentFiles)
      || ctx.loadedRemoteRegistration !== ctx.currentRemoteRegistration
      || ctx.loadedRemote !== remoteExtensionFingerprint(remoteConfiguration(ctx).packages)
      || (ctx.active !== undefined && (ctx.active.loadedProject?.id !== ctx.dependencies.projectId?.()
        || ctx.active.loadedProject?.name !== ctx.dependencies.projectName?.()));
    return catalog;
  }
