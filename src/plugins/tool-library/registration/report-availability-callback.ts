import type { ToolLibraryRegistrationContext } from "../registration-types.ts";
import type { Availability } from "../../../codemode/tool-library/library-types.ts";
import { structured } from "./encode-library-result.ts";

export function reportAvailabilityCallback(ctx: ToolLibraryRegistrationContext, args: { tools: Availability[] }) {
  ctx.library.report(ctx.target, args.tools); return structured({ recorded: true });
}
