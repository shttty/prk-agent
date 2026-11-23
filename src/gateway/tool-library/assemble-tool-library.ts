import { toolsList } from "./list-tools.ts";
import { toolsChange } from "./change-tool.ts";
import type { HostContext } from "../host/host-state.ts";
import type { ToolLibraryMethods } from "./tool-library-methods.ts";

export function assembleToolLibrary(ctx: HostContext): ToolLibraryMethods {
  return {
    toolsList: toolsList.bind(undefined, ctx),
    toolsChange: toolsChange.bind(undefined, ctx),
  };
}
