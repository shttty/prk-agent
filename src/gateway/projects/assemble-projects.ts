import { manageProject } from "./manage-project.ts";
import { assignProject } from "./assign-project.ts";
import { renameProject } from "./rename-project.ts";
import type { HostContext } from "../host/host-state.ts";
import type { ProjectsMethods } from "./projects-methods.ts";

export function assembleProjects(ctx: HostContext): ProjectsMethods {
  return {
    manageProject: manageProject.bind(undefined, ctx),
    assignProject: assignProject.bind(undefined, ctx),
    renameProject: renameProject.bind(undefined, ctx),
  };
}
