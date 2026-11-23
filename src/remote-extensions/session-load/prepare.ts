import { posix, relative } from "node:path";
import { buildNativeToolHost } from "../bundle/build-native-tool-host.ts";
import type { RemoteExtensionArtifactSource } from "../deployment/deployment-types.ts";
import { createRemoteExtensionFactory } from "../generation/create-extension-factory.ts";
import { resolvePluginExtensionPaths } from "../../plugins/packages/resolve-extension-paths.ts";
import { buildDirectoryPackage } from "../bundle/build-directory-package.ts";
import type { RemoteExtensionStatus } from "../packages/package-types.ts";
import type { RemoteExtensionLoad, RemoteExtensionLoadInput } from "./load-types.ts";
import { assembleSessionLoad } from "./assemble-session-load.ts";
import { publish } from "./status/publish-status.ts";
import { recordHostError } from "./status/record-host-error.ts";
import { publishHostEvent } from "./status/publish-host-event.ts";
import { recordGeneration } from "./status/record-generation.ts";
import { readProjectTrust } from "./read-project-trust.ts";
import { loadFactory } from "./lifecycle/load-factory.ts";
import { WireError } from "../../gateway/wire/create-error.ts";

/** Adapter-owned load resources; Pi still owns registrations, events and session lifecycle. */
export async function prepareRemoteExtensions(input: RemoteExtensionLoadInput): Promise<RemoteExtensionLoad> {
  const ctx = assembleSessionLoad(input);
  const projectExtensions = ctx.input.projectTrusted() ? [...new Set(ctx.input.projectExtensions ?? [])] : [];
  if (projectExtensions.some((path) => typeof path !== "string" || !posix.isAbsolute(path))) {
    throw new Error("Project extension entries must be absolute target paths.");
  }
  for (const path of projectExtensions) {
    const status: RemoteExtensionStatus = { name: `Project extension: ${path}`, instance: ctx.input.target.id, location: "target", ...(ctx.input.sessionId === undefined ? {} : { sessionId: ctx.input.sessionId }) };
    ctx.statuses.push(status);
    ctx.remoteStatuses.set(status.name, status);
    ctx.projectEntries.set(status.name, path);
  }
  if (ctx.input.nativeTools) {
    const store = ctx.input.store;
    if (!store || store.directory !== ctx.input.storeDir) throw new Error("Remote native tools require the Gateway-owned artifact store.");
    ctx.nativeStatus = { name: "Pi native tools", instance: ctx.input.target.id, location: "target", ...(ctx.input.sessionId === undefined ? {} : { sessionId: ctx.input.sessionId }) };
    ctx.statuses.push(ctx.nativeStatus);
    ctx.remoteStatuses.set(ctx.nativeStatus.name, ctx.nativeStatus);
  }
  for (const pkg of ctx.input.packages) {
    if (!pkg.enabled || pkg.location !== "host") continue;
    const status: RemoteExtensionStatus = { name: pkg.source, instance: ctx.input.target.id, location: "target", ...(ctx.input.sessionId === undefined ? {} : { sessionId: ctx.input.sessionId }) };
    ctx.statuses.push(status);
    try {
      const entries = await resolvePluginExtensionPaths(pkg);
      if (!entries.length) continue;
      if (ctx.input.target.local) ctx.remotePackages.push({ name: pkg.source, extensions: entries });
      else {
        if (!ctx.input.store || !pkg.installedPath) throw new Error("Host plugins require an installed directory and Gateway artifact store.");
        const artifact = await buildDirectoryPackage(ctx.input.store, pkg.installedPath, true);
        const selected = entries.map((entry) => posix.join("node_modules", pkg.name, relative(pkg.installedPath!, entry)));
        if (selected.some((entry) => !artifact.extensions.includes(entry))) throw new Error("Selected plugin entries are not included in its package artifact.");
        ctx.remotePackages.push({ name: pkg.source, artifacts: { node: artifact.node, bundle: artifact.bundle }, extensions: selected });
      }
      ctx.remoteStatuses.set(status.name, status);
    } catch (error) {
      const buildFailure = error instanceof WireError && error.code === "ENVIRONMENT_REQUIRED" && typeof error.details?.packageHash === "string"
        ? ctx.input.packageErrors?.find((entry) => entry.name === pkg.source && entry.errorCode === "PLUGIN_BUILD_FAILED" && entry.errorDetails?.packageHash === error.details?.packageHash)
        : undefined;
      status.error = buildFailure?.error ?? (error instanceof Error ? error.message : String(error));
      if (buildFailure) { status.errorCode = buildFailure.errorCode; status.errorDetails = buildFailure.errorDetails; }
      else if (error instanceof WireError) { status.errorCode = error.code; status.errorDetails = error.details; }
    }
  }
  if (ctx.remoteStatuses.size) {
    if (!ctx.input.store || ctx.input.store.directory !== ctx.input.storeDir) throw new Error("Session hosts require the Gateway-owned artifact store.");
    const artifacts: RemoteExtensionArtifactSource = (platform) => buildNativeToolHost({ store: ctx.input.store!, platform, cacheOnly: true });
    const name = `remote:${ctx.input.target.id}`;
    const factory = createRemoteExtensionFactory({
      channels: ctx.input.channels, machine: ctx.input.target.id, storeDir: ctx.input.storeDir,
      artifacts, packages: ctx.remotePackages, projectExtensions, cwd: ctx.input.target.kernel.cwd, nativeTools: !!ctx.nativeStatus,
      providerOwnerIds: ctx.input.providerOwnerIds,
      hostOptions: ctx.input.hostOptions,
      binChunkBytes: ctx.input.binChunkBytes,
      env: ctx.input.env,
      mapNativeTool: ctx.input.mapNativeTool,
      onCreated(generation) { ctx.generations.push(generation); },
      onFrozen: ctx.input.onFrozen,
      telemetryIntervalMs: ctx.input.telemetryIntervalMs,
      onMonitor: ctx.input.onMonitor,
      get projectTrusted() { return readProjectTrust(ctx); },
      onError(error) { recordHostError(ctx, error); },
      onEvent(event) { publishHostEvent(ctx, event); },
      onGeneration(generation) { recordGeneration(ctx, generation); },
      onProviderError() { publish(ctx); },
    });
    ctx.load.factories.push({ name, factory: async (pi) => loadFactory(ctx, factory, pi) });
    // The inline factory owns one process; package load errors remain in per-package status.
    ctx.managedErrors.set(`<inline:${name}>`, ctx.nativeStatus ?? ctx.remoteStatuses.values().next().value!);
  }
  if (!ctx.remoteStatuses.size) ctx.input.onMonitor?.(null);
  publish(ctx);
  return ctx.load;
}
