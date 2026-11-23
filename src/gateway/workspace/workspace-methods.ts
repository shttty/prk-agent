import type { closeModelTerminals } from "./close-model-terminals.ts";
import type { workspaceContext } from "./resolve-workspace-context.ts";
import type { workspace } from "./execute-workspace-request.ts";
import type { subscribeTerminal } from "./subscribe-terminal.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface WorkspaceMethods {
  closeModelTerminals: WithoutContext<typeof closeModelTerminals>;
  workspaceContext: WithoutContext<typeof workspaceContext>;
  workspace: WithoutContext<typeof workspace>;
  subscribeTerminal: WithoutContext<typeof subscribeTerminal>;
}
