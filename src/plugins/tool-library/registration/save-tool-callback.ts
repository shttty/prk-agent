import type { ToolLibraryRegistrationContext } from "../registration-types.ts";
import type { ToolSource } from "../../../codemode/tool-library/library-types.ts";
import { structured } from "./encode-library-result.ts";

export function saveToolCallback(ctx: ToolLibraryRegistrationContext, args: ToolSource) {
  return structured({ tool: ctx.library.save(args) });
}
