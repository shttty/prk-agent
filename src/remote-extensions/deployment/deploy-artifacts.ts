import { posix } from "node:path";
import type { ArtifactPlatform } from "../../artifacts/store/store-types.ts";
import { DEFAULT_REMOTE_HOST_OPTIONS, type RemoteHostOptions } from "../../config/remote-host/remote-host-options.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import { install } from "./install-artifact.ts";
import type { DeploymentContext, RemoteExtensionArtifactSource } from "./deployment-types.ts";
import { DEFAULT_CODEMODE_OPTIONS } from "../../config/codemode/codemode-options.ts";

export async function deployRemoteExtensionArtifacts(
  lease: TargetLease,
  storeDir: string,
  source: RemoteExtensionArtifactSource,
  nativeTools = false,
  runtime: RemoteHostOptions["runtime"] = DEFAULT_REMOTE_HOST_OPTIONS.runtime,
  binChunkBytes: number = DEFAULT_CODEMODE_OPTIONS.binChunkBytes,
): Promise<{ runtime: string; bundle: string; toolDirs: string[] }> {
  const platform = await lease.request("remoteExtensions", "platform");
  if (typeof platform.system !== "string" || typeof platform.machine !== "string") {
    throw new Error("Remote extension target returned an invalid platform.");
  }
  const target = { system: platform.system, machine: platform.machine };
  const architectures: Record<string, ArtifactPlatform> = { x86_64: "x86_64", amd64: "x86_64", aarch64: "aarch64", arm64: "aarch64" };
  const architecture = architectures[target.machine.toLowerCase()];
  if (target.system !== "Linux" || !architecture) throw new Error(`Unsupported remote extension target platform: ${target.system}/${target.machine}.`);
  const names = typeof source === "function" ? await source(architecture) : source;
  const ctx: DeploymentContext = { lease, storeDir, target, binChunkBytes };

  const executable = runtime === "bun" ? await install(ctx, "bun", "tool") : await install(ctx, names.node, "binary");
  const bundle = await install(ctx, names.bundle, "tar");
  const toolDirs: string[] = [];
  if (nativeTools) {
    for (const name of ["rg", "fd"]) toolDirs.push(posix.dirname(await install(ctx, name, "tool")));
  }
  return { runtime: executable, bundle, toolDirs };
}
