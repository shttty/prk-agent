import { WireError } from "../../gateway/wire/create-error.ts";
import type { DeploymentContext, DeploymentArtifact } from "./deployment-types.ts";
import { readArtifact } from "./read-artifact.ts";

export async function install(ctx: DeploymentContext, name: string, kind: DeploymentArtifact["kind"]): Promise<string> {
  const asset = await readArtifact(ctx, name, kind);
  if (!asset.cached) throw new WireError("ENVIRONMENT_REQUIRED", `Deploy the instance environment before using ${name}.`, { artifact: name });
  return asset.path;
}
