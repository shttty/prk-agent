import type { publishTargets } from "./configuration/publish-instances.ts";
import type { mutatePersistedTargets } from "./configuration/mutate-persisted-instances.ts";
import type { reloadTargets } from "./configuration/reload-instances.ts";
import type { addTarget } from "./configuration/add-instance.ts";
import type { getTarget } from "./configuration/get-instance.ts";
import type { editTarget } from "./configuration/edit-instance.ts";
import type { deleteTarget } from "./configuration/delete-instance.ts";
import type { inspectTarget } from "./discovery/inspect-instance.ts";
import type { browseTarget } from "./discovery/browse-instance.ts";
import type { getTargetEnvironment } from "../instance-environments/get-environment.ts";
import type { deployTargetEnvironment } from "../instance-environments/deploy-environment.ts";
import type { requireEnvironment } from "../instance-environments/require-environment.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface InstancesMethods {
  publishTargets: WithoutContext<typeof publishTargets>;
  mutatePersistedTargets: WithoutContext<typeof mutatePersistedTargets>;
  reloadTargets: WithoutContext<typeof reloadTargets>;
  addTarget: WithoutContext<typeof addTarget>;
  getTarget: WithoutContext<typeof getTarget>;
  editTarget: WithoutContext<typeof editTarget>;
  deleteTarget: WithoutContext<typeof deleteTarget>;
  inspectTarget: WithoutContext<typeof inspectTarget>;
  browseTarget: WithoutContext<typeof browseTarget>;
  getTargetEnvironment: WithoutContext<typeof getTargetEnvironment>;
  deployTargetEnvironment: WithoutContext<typeof deployTargetEnvironment>;
  requireEnvironment: WithoutContext<typeof requireEnvironment>;
}
