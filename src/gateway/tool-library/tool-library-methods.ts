import type { toolsList } from "./list-tools.ts";
import type { toolsChange } from "./change-tool.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface ToolLibraryMethods {
  toolsList: WithoutContext<typeof toolsList>;
  toolsChange: WithoutContext<typeof toolsChange>;
}
