import { answerBinRequest } from "../../codemode/binary-delivery/answer-bin-request.ts";
import type { DeploymentContext, DeploymentArtifact } from "./deployment-types.ts";

export async function readArtifact(ctx: DeploymentContext, name: string, kind: DeploymentArtifact["kind"]): Promise<DeploymentArtifact> {
  const metadata = await answerBinRequest(ctx.storeDir, { name, ...ctx.target });
  if (!("sha256" in metadata) || !Number.isSafeInteger(metadata.size) || metadata.size < 0) throw new Error(`Invalid artifact metadata for ${name}.`);
  if (kind !== "tool" && name !== `remote-ext-${kind === "tar" ? "bundle" : "node"}-${metadata.sha256}`) throw new Error(`Artifact ${name} is not an immutable SHA-256 reference.`);
  const result = await ctx.lease.request("remoteExtensions", "assetCheck", { ...metadata, kind,
    ...(kind === "tool" ? { name } : {}) });
  if (typeof result.cached !== "boolean" || typeof result.path !== "string" || !result.path.startsWith("/")) throw new Error(`Invalid target artifact result for ${name}.`);
  return { name, kind, ...metadata, cached: result.cached, path: result.path };
}
