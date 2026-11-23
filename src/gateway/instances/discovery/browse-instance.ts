import type { HostContext } from "../../host/host-state.ts";
import type { TargetConnection, AbsoluteListing } from "../instance-types.ts";
import { discoveryConnection } from "../resolve-discovery-connection.ts";
import { createTargetEnvironments } from "../../../target-environment/connection/assemble-environments.ts";
import { assembleFiles } from "../../../workspace/target-files/assemble-files.ts";

export async function browseTarget(ctx: HostContext, { connection, path }: { connection: TargetConnection; path: string }): Promise<AbsoluteListing> {
  const input = discoveryConnection(connection, ctx.host.config.limits);
  const files = assembleFiles({ environments: createTargetEnvironments({ resolve: () => input, targetCacheRoot: ctx.host.config.targetCacheRoot }),
    workspace: ctx.host.config.workspace, references: ctx.host.config.references, targetConnection: ctx.host.config.targetConnection });
  const result = await files.browse({ target: "draft", sessionId: "", cwd: connection.cwd ?? "/" }, path);
  return { path: result.path, atRoot: result.atRoot, truncated: result.truncated,
    entries: result.entries.filter((entry) => entry.type === "file" || entry.type === "directory")
      .map((entry) => ({ name: entry.name, path: entry.path, type: entry.type as "file" | "directory" })) };
}
