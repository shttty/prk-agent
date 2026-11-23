import type { manageProject } from "./manage-project.ts";
import type { assignProject } from "./assign-project.ts";
import type { renameProject } from "./rename-project.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface ProjectsMethods {
  manageProject: WithoutContext<typeof manageProject>;
  assignProject: WithoutContext<typeof assignProject>;
  renameProject: WithoutContext<typeof renameProject>;
}
