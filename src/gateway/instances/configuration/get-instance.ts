import { configurationIssue } from "../../../config/execution-target/configuration-issue.ts";
import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { EditableExecutionTarget } from "../instance-types.ts";
import { WireError } from "../../wire/create-error.ts";

export function getTarget(ctx: HostContext, id: Parameters<GatewaySessionHost["getTarget"]>[0]): EditableExecutionTarget {
      const target = ctx.instances.targets.find((candidate) => candidate.id === id);
      if (!target) throw new WireError("NOT_FOUND", "Execution target is not configured.");
      return Object.freeze({
        id: target.id,
        environment: ctx.methods.getTargetEnvironment({ target: target.id }),
        label: target.label,
        local: target.local === true,
        tags: Object.freeze([...(target.tags ?? [])]),
        ...(target.sshCommand === undefined ? {} : { sshCommand: target.sshCommand }),
        ...(target.python === undefined ? {} : { python: target.python }),
        ...(target.pythonIndexUrl === undefined ? {} : { pythonIndexUrl: target.pythonIndexUrl }),
        ...(target.bunPackages === undefined ? {} : { bunPackages: target.bunPackages }),
        ...(configurationIssue(target) ? { configurationIssue: configurationIssue(target) } : {}),
        cwd: target.kernel.cwd,
        ...(target.kernel.executionTimeoutMs === undefined ? {} : { executionTimeoutMs: target.kernel.executionTimeoutMs }),
        ...(target.kernel.kernelOptions === undefined ? {} : { kernel: target.kernel.kernelOptions }),
        ...(target.customMetrics === undefined ? {} : { customMetrics: target.customMetrics }),
      });
    }
