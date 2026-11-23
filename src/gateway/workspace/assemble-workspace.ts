import { closeModelTerminals } from "./close-model-terminals.ts";
import { workspaceContext } from "./resolve-workspace-context.ts";
import { workspace } from "./execute-workspace-request.ts";
import { subscribeTerminal } from "./subscribe-terminal.ts";
import type { HostContext } from "../host/host-state.ts";
import type { WorkspaceMethods } from "./workspace-methods.ts";

export function assembleWorkspace(ctx: HostContext): WorkspaceMethods {
  return {
    closeModelTerminals: closeModelTerminals.bind(undefined, ctx),
    workspaceContext: workspaceContext.bind(undefined, ctx),
    workspace: workspace.bind(undefined, ctx),
    subscribeTerminal: subscribeTerminal.bind(undefined, ctx),
  };
}
