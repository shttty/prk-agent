import type { HostContext } from "../host/host-state.ts";
import { assembleFiles } from "../../workspace/target-files/assemble-files.ts";
import { createPtyTerminals } from "../../workspace/pty-terminals/assemble-terminals.ts";
import { requireConfigured } from "../../config/execution-target/require-configured.ts";
import { WireError } from "../wire/create-error.ts";
import { resolvePythonRuntime } from "../../target-environment/python/resolve-python-runtime.ts";
import { pythonIndexEnvironment } from "../../target-environment/python/python-index-environment.ts";

export function openWorkspace(ctx: HostContext): void {
  ctx.workspace.files = assembleFiles({ environments: ctx.host.environments, workspace: ctx.host.config.workspace,
    references: ctx.host.config.references, targetConnection: ctx.host.config.targetConnection });
  ctx.workspace.terminals = createPtyTerminals({ workspace: ctx.host.config.workspace,
    acquire: (id) => ctx.host.environments.acquire(id),
    onCleanupUnknown: (error, sessionId, name) => console.error("Terminal cleanup unconfirmed", sessionId, name, error),
    ownerTarget(sessionId) {
      const owner = ctx.host.history.get(sessionId);
      return owner && !owner.archived ? owner.target : undefined;
    },
    runtime(name, environment) {
      const target = ctx.instances.targets.find((candidate) => candidate.id === name);
      if (!target) throw new WireError("NOT_FOUND", `Terminal target ${name} is no longer configured.`);
      requireConfigured(target);
      return resolvePythonRuntime(environment, target, ctx.host.config.targetCacheRoot,
        (instance, paths) => pythonIndexEnvironment(instance.pythonIndexUrl ?? ctx.host.config.pythonIndexUrl, paths));
    },
  });
}
