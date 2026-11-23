import type { LoadContext } from "./load-types.ts";

export function readProjectTrust(ctx: LoadContext): boolean {
  return ctx.input.projectTrusted();
}
