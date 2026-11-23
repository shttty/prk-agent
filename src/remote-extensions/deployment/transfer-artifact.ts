import { RemoteExecutionEnv } from "@earendil-works/pi-env";
import type { TargetEnvironmentLease } from "../../target-environment/connection/connection-types.ts";
import type { DeploymentContext, DeploymentArtifact } from "./deployment-types.ts";
import { writeTransferredArtifact } from "./write-transferred-artifact.ts";

export async function transferArtifact(ctx: DeploymentContext, asset: DeploymentArtifact, transfer: { path: string; size: number; gzip: boolean }, environment: TargetEnvironmentLease, acknowledged: (bytes: number) => void): Promise<boolean> {
  const { name, kind, sha256, size } = asset;
  const begin = await ctx.lease.request("remoteExtensions", "assetBegin", { sha256, size, kind,
    ...(kind === "tool" ? { name } : {}) });
  if (typeof begin.cached !== "boolean" || begin.path !== asset.path) throw new Error(`Target artifact changed: ${name}.`);
  if (begin.cached) return false;
  if (typeof begin.uploadPath !== "string" || typeof begin.blob !== "string") throw new Error(`Invalid artifact staging path: ${name}.`);
  const remote = new RemoteExecutionEnv({ connection: environment.connection, id: environment.generation, cwd: "/" });
  try {
    await writeTransferredArtifact({ remote, signal: environment.signal, binChunkBytes: ctx.binChunkBytes }, {
      name, sha256, executable: kind !== "tar",
    }, transfer, { uploadPath: begin.uploadPath, blob: begin.blob }, acknowledged);
    const finish = await ctx.lease.request("remoteExtensions", "assetFinish", { sha256 });
    if (finish.path !== asset.path) throw new Error(`Target artifact path changed: ${name}.`);
    return true;
  } catch (error) {
    try { await ctx.lease.request("remoteExtensions", "assetAbort", { sha256 }); } catch { /* Lost channel shutdown owns its staged uploads. */ }
    throw error;
  }
}
