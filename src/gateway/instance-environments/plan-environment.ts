import type { HostContext } from "../host/host-state.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import type { DeploymentArtifact, DeploymentContext } from "../../remote-extensions/deployment/deployment-types.ts";
import { buildNativeToolHost } from "../../remote-extensions/bundle/build-native-tool-host.ts";
import { readArtifact } from "../../remote-extensions/deployment/read-artifact.ts";
import { planHostPackage } from "./plan-host-package.ts";
import { listBinaries } from "../../codemode/binary-delivery/list-binaries.ts";
import { discoverKernelToolCatalog } from "../../codemode/module-catalog/discover-kernel-tool-catalog.ts";
import { WireError } from "../wire/create-error.ts";

export async function planEnvironment(ctx: HostContext, targetName: string, lease: TargetLease, allowBuild = false): Promise<{ context: DeploymentContext; artifacts: DeploymentArtifact[] }> {
  const target = ctx.instances.targets.find(({ id }) => id === targetName);
  if (!target) throw new WireError("NOT_FOUND", "Execution target is not configured.");
  const platform = await lease.request("remoteExtensions", "platform");
  const architecture = platform.machine === "x86_64" || platform.machine === "amd64" ? "x86_64" : platform.machine === "aarch64" || platform.machine === "arm64" ? "aarch64" : undefined;
  if (platform.system !== "Linux" || !architecture) throw new Error(`Unsupported environment platform: ${platform.system}/${platform.machine}`);
  const context: DeploymentContext = { lease, storeDir: ctx.host.artifactStore.directory, target: { system: "Linux", machine: architecture }, binChunkBytes: ctx.host.config.codemode.binChunkBytes };
  const native = await buildNativeToolHost({ store: ctx.host.artifactStore, platform: architecture, cacheOnly: !allowBuild });
  const required = new Map<string, DeploymentArtifact["kind"]>();
  required.set(ctx.host.config.remoteHost.runtime === "bun" ? "bun" : native.node, ctx.host.config.remoteHost.runtime === "bun" ? "tool" : "binary");
  if (target.bunPackages) required.set("bun", "tool");
  required.set(native.bundle, "tar");
  for (const pkg of ctx.methods.remoteConfiguration(targetName).packages) {
    if (!pkg.enabled || pkg.location !== "host" || target.local) continue;
    const bundle = await planHostPackage(ctx, targetName, pkg, allowBuild);
    if (bundle) required.set(bundle, "tar");
  }
  required.set("rg", "tool");
  required.set("fd", "tool");
  for (const name of listBinaries(context.storeDir)) required.set(name, "tool");
  for (const entry of await discoverKernelToolCatalog(ctx.host.paths.home, targetName)) {
    for (const name of entry.dependencies?.binaries ?? []) required.set(name, "tool");
  }
  const artifacts = [];
  for (const [name, kind] of required) artifacts.push(await readArtifact(context, name, kind));
  return { context, artifacts };
}
