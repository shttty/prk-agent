import type { ToolLibraryContext } from "../library-state.ts";
import type { Availability } from "../library-types.ts";

export function report(ctx: ToolLibraryContext, target: string, results: Availability[]): void {
  ctx.availability.set(target, new Map(results.map((result) => [`${result.name}:${result.version}`, result])));
  for (const listener of ctx.listeners) listener();
}
