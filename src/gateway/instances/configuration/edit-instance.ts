import { isDeepStrictEqual } from "node:util";
import { inspectTarget } from "../discovery/inspect-instance.ts";
import { configurationIssue } from "../../../config/execution-target/configuration-issue.ts";
import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { WorkbenchSnapshot } from "../../session-views/session-view-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { targetConfig } from "../serialize-instance.ts";
import { executionTargetFromConfig } from "../../../config/execution-target/from-config.ts";
import { persistedId } from "../match-persisted-id.ts";

export async function editTarget(ctx: HostContext, request: Parameters<GatewaySessionHost["editTarget"]>[0]): Promise<WorkbenchSnapshot> {
      if (ctx.host.options.targets !== undefined) {
        throw new WireError("UNSUPPORTED_METHOD", "Target configuration editing is unavailable when targets are explicitly supplied.");
      }
      const patch = request.target;
      const current = ctx.instances.targets.find((candidate) => candidate.id === patch.id);
      if (!current) throw new WireError("NOT_FOUND", "Execution target is not configured; no configuration was changed.");
      const merged = { ...targetConfig(current), ...patch, id: current.id };
      if (merged.local === true || merged.sshCommand === "") delete merged.sshCommand;
      if (merged.python === "") delete merged.python;
      if (typeof merged.pythonIndexUrl === "string" && !merged.pythonIndexUrl.trim()) delete merged.pythonIndexUrl;
      const target = executionTargetFromConfig(merged, ctx.host.config.limits, ctx.host.config.kernel);
      if (!configurationIssue(target) && (target.local !== current.local || target.sshCommand !== current.sshCommand || target.python !== current.python)) {
        await inspectTarget(ctx, { connection: { local: target.local, sshCommand: target.sshCommand, python: target.python } });
      }
      const normalized = targetConfig(target);
      await ctx.methods.exclusive(() => ctx.methods.mutatePersistedTargets((document, persisted) => {
        const latest = persisted.find((candidate) => candidate.id === current.id);
        if (!latest || !isDeepStrictEqual(targetConfig(latest), targetConfig(current))) {
          throw new WireError("CONFLICT", "Instance changed during connection inspection; reload it before editing.");
        }
        let found = false;
        document.instances = document.instances.map((entry) => {
          if (!persistedId(entry, current.id)) return entry;
          found = true;
          return normalized;
        });
        if (!found) throw new WireError("NOT_FOUND", "Execution target is not configured; no configuration was changed.");
      }));
      if (!configurationIssue(target) && (target.local !== current.local || target.sshCommand !== current.sshCommand || target.python !== current.python)) ctx.methods.deployTargetEnvironment({ target: target.id });
      return ctx.methods.workbenchSnapshot();
    }
