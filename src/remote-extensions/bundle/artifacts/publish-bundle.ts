import { join } from "node:path";
import type { ArtifactPlatform } from "../../../artifacts/store/store-types.ts";
import type { ArtifactStore } from "../../../artifacts/store/assemble-store.ts";
import { run } from "../archive/run-archive-command.ts";
import { nodeRuntime } from "../runtime/resolve-node-runtime.ts";
import type { RemoteExtensionArtifacts } from "../bundle-types.ts";
import { publish } from "./publish-artifact.ts";

export async function publishBundle(store: ArtifactStore, platform: ArtifactPlatform, work: string, bundle: string): Promise<RemoteExtensionArtifacts & { sha256: string }> {
  const archive = join(work, "bundle.tar.gz");
  await run("tar", ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "-czf", archive, "-C", bundle, "."]);
  const node = await publish(store, "node", platform, await nodeRuntime(platform, work));
  const artifact = await publish(store, "bundle", platform, archive);
  return { node: node.name, bundle: artifact.name, sha256: artifact.sha256 };
}
