import type { HostPluginPackage } from "../../../plugins/packages/package-types.ts";
import type { CapabilityCatalog, CapabilityEntry } from "../../../config/capabilities/capability-types.ts";
import { isExtensionToolAllowedByFilter } from "../../../config/extensions/tool-selection/is-tool-allowed.ts";
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

export function projectCatalog(
  ctx: RuntimeContext,
  entries: CapabilityMetadata[],
  observeReload?: (pending: boolean, describe: () => Record<string, unknown>) => void,
): CapabilityCatalog {
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
    const currentRemote = remoteExtensionFingerprint(remoteConfiguration(ctx).packages);
    const currentProject = { id: ctx.dependencies.projectId?.(), name: ctx.dependencies.projectName?.() };
    const loadedProject = ctx.active?.loadedProject;
    const unloaded = (entry: CapabilityEntry) => entry.available !== false && !entry.loaded && canLoadResource(ctx, entry);
    const missingEntries = catalog.entries.some(unloaded);
    const sharedPaths = currentShared.size !== ctx.sharedPaths.size || [...currentShared].some((path) => !ctx.sharedPaths.has(path));
    const registrationFiles = fileVersionsChanged(ctx.registrationFiles, currentFiles);
    const remoteRegistration = ctx.loadedRemoteRegistration !== ctx.currentRemoteRegistration;
    const remotePackages = ctx.loadedRemote !== currentRemote;
    const project = ctx.active !== undefined && (loadedProject?.id !== currentProject.id || loadedProject?.name !== currentProject.name);
    catalog.requiresReload = missingEntries || sharedPaths || registrationFiles || remoteRegistration || remotePackages || project;
    observeReload?.(catalog.requiresReload, () => ({
      ...(missingEntries ? { missingEntries: catalog.entries.filter(unloaded).slice(0, 5).map((entry) => entry.id) } : {}),
      ...(sharedPaths ? { sharedPaths: [...new Set([...ctx.sharedPaths, ...currentShared])]
        .filter((path) => ctx.sharedPaths.has(path) !== currentShared.has(path)).slice(0, 5) } : {}),
      ...(registrationFiles ? { registrationFiles: changedPaths(ctx.registrationFiles, currentFiles) } : {}),
      ...(remoteRegistration ? { remoteRegistration: changedPaths(
        new Map(JSON.parse(ctx.loadedRemoteRegistration || "[]")), new Map(JSON.parse(ctx.currentRemoteRegistration || "[]")),
      ) } : {}),
      ...(remotePackages ? { remotePackages: { previous: packageSources(ctx.loadedRemote), current: packageSources(currentRemote) } } : {}),
      ...(project ? { project: { previous: loadedProject ?? null, current: currentProject } } : {}),
    }));
    return catalog;
  }

function canLoadResource(ctx: RuntimeContext, entry: CapabilityEntry): boolean {
  if (entry.kind === "skill") return !ctx.sessionOptions.noSkills;
  // noExtensions disables discovery, not inline factories or explicit instance extensions.
  return isExtensionToolAllowedByFilter(entry.name, ctx.dependencies.extensionFilter)
    && (!ctx.sessionOptions.noExtensions || entry.instance !== undefined || ctx.toolInventory.some((tool) => tool.name === entry.name));
}

function changedPaths(loaded: ReadonlyMap<string, string>, current: ReadonlyMap<string, string>): string[] {
  return [...new Set([...loaded.keys(), ...current.keys()])].filter((path) => loaded.get(path) !== current.get(path)).slice(0, 5);
}

function packageSources(fingerprint: string) {
  const packages: HostPluginPackage[] = JSON.parse(fingerprint || "[]");
  return packages.slice(0, 5).map(({ sourceDisplay, version }) => ({ sourceDisplay, version }));
}
