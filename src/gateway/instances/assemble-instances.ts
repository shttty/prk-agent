import { publishTargets } from "./configuration/publish-instances.ts";
import { mutatePersistedTargets } from "./configuration/mutate-persisted-instances.ts";
import { reloadTargets } from "./configuration/reload-instances.ts";
import { addTarget } from "./configuration/add-instance.ts";
import { getTarget } from "./configuration/get-instance.ts";
import { editTarget } from "./configuration/edit-instance.ts";
import { deleteTarget } from "./configuration/delete-instance.ts";
import { inspectTarget } from "./discovery/inspect-instance.ts";
import { browseTarget } from "./discovery/browse-instance.ts";
import type { HostContext } from "../host/host-state.ts";
import type { InstancesMethods } from "./instances-methods.ts";
import { getTargetEnvironment } from "../instance-environments/get-environment.ts";
import { deployTargetEnvironment } from "../instance-environments/deploy-environment.ts";
import { requireEnvironment } from "../instance-environments/require-environment.ts";

export function assembleInstances(ctx: HostContext): InstancesMethods {
  ctx.instances.environments = new Map();
  return {
    publishTargets: publishTargets.bind(undefined, ctx),
    mutatePersistedTargets: mutatePersistedTargets.bind(undefined, ctx),
    reloadTargets: reloadTargets.bind(undefined, ctx),
    addTarget: addTarget.bind(undefined, ctx),
    getTarget: getTarget.bind(undefined, ctx),
    editTarget: editTarget.bind(undefined, ctx),
    deleteTarget: deleteTarget.bind(undefined, ctx),
    inspectTarget: inspectTarget.bind(undefined, ctx),
    browseTarget: browseTarget.bind(undefined, ctx),
    getTargetEnvironment: getTargetEnvironment.bind(undefined, ctx),
    deployTargetEnvironment: deployTargetEnvironment.bind(undefined, ctx),
    requireEnvironment: requireEnvironment.bind(undefined, ctx),
  };
}
