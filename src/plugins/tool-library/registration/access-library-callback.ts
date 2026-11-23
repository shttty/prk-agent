import type { ToolLibraryRegistrationContext } from "../registration-types.ts";
import { structured } from "./encode-library-result.ts";

export function accessLibraryCallback(ctx: ToolLibraryRegistrationContext) {
  ctx.refresh(); return structured({ tools: ctx.library.list().filter((entry) => entry.status !== "archived" && ctx.allowed(`prk_saved_${entry.name}`)) });
}
