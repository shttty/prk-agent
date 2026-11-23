import { inspectTarget } from "../discovery/inspect-instance.ts";
import { configurationIssue } from "../../../config/execution-target/configuration-issue.ts";
import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { WorkbenchSnapshot } from "../../session-views/session-view-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { executionTargetFromConfig } from "../../../config/execution-target/from-config.ts";
import { targetConfig } from "../serialize-instance.ts";

export async function addTarget(ctx: HostContext, request: Parameters<GatewaySessionHost["addTarget"]>[0]): Promise<WorkbenchSnapshot> {
      if (ctx.host.options.targets !== undefined) {
        throw new WireError("UNSUPPORTED_METHOD", "Target configuration editing is unavailable when targets are explicitly supplied.");
      }
      if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; target was not added.");
      const target = executionTargetFromConfig(request.target, ctx.host.config.limits, ctx.host.config.kernel);
      if (!configurationIssue(target)) await inspectTarget(ctx, { connection: { local: target.local, sshCommand: target.sshCommand, python: target.python } });
      const normalized = targetConfig(target);
      await ctx.methods.exclusive(() => ctx.methods.mutatePersistedTargets((document) => {
        document.instances.push(normalized);
      }));
      if (!configurationIssue(target)) ctx.methods.deployTargetEnvironment({ target: target.id });
      return ctx.methods.workbenchSnapshot();
    }
