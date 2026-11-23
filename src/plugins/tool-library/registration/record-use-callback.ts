import type { ToolLibraryRegistrationContext } from "../registration-types.ts";
import { structured } from "./encode-library-result.ts";

export function recordUseCallback(ctx: ToolLibraryRegistrationContext, args: { name: string; version: number }) {
  ctx.library.used(args.name, args.version, ctx.sessionId()); return structured({ recorded: true });
}
